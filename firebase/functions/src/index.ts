/**
 * Firebase Cloud Functions for Penalty Wallet System
 * 
 * IMPORTANT: These are TEMPLATE files. You need to:
 * 1. Set up a Firebase project with Blaze (pay-as-you-go) plan
 * 2. Configure Stripe with your secret key
 * 3. Deploy these functions to your Firebase project
 * 
 * Copy this file to: firebase/functions/src/index.ts in your Firebase project
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';
import Stripe from 'stripe';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Stripe (secret key from Firebase secrets)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// ============================================================================
// TYPES
// ============================================================================

interface WalletData {
  userId: string;
  balance: number;
  stripeCustomerId: string | null;
  accountabilityPartner: {
    name: string;
    email: string;
    iban: string;
    notifyOnPenalty: boolean;
  } | null;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

type FirestoreTimestampValue = admin.firestore.Timestamp | admin.firestore.FieldValue;
type WalletWriteData = Omit<WalletData, 'createdAt' | 'updatedAt'> & {
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
};

interface AccountabilityPartnerInput {
  name: string;
  email: string;
  iban: string;
  notifyOnPenalty: boolean;
}

interface LearningImportRow {
  deck: string;
  front: string;
  back: string;
  type?: 'basic' | 'cloze';
  tags?: string[];
  language?: string;
  clozeText?: string;
  expectedAnswer?: string;
  mediaUrl?: string;
}

interface CardRecord {
  userId: string;
  deckId: string;
  state: string;
  dueAt?: number;
}

interface ReviewInput {
  cardId: string;
  rating: number;
  wasCorrect: boolean;
}

interface ReviewLog {
  userId: string;
  cardId: string;
  deckId: string;
  rating: number;
  wasCorrect: boolean;
  reviewedAt: number;
  previousState: string;
  newState: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

// ============================================================================
// HELPER: Verify Firebase Auth Token
// ============================================================================

async function verifyAuthToken(req: functions.https.Request): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new functions.https.HttpsError('unauthenticated', 'Missing auth token');
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
}

// ============================================================================
// 1. CREATE CHECKOUT SESSION (Deposit Money)
// ============================================================================

export const createCheckoutSession = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const { amount } = req.body;

      if (!amount || amount < 1 || amount > 500) {
        res.status(400).json({ error: 'Amount must be between €1 and €500' });
        return;
      }

      // Get or create Stripe customer
      const walletDoc = await db.collection('wallets').doc(userId).get();
      let stripeCustomerId = walletDoc.data()?.stripeCustomerId;

      if (!stripeCustomerId) {
        const user = await admin.auth().getUser(userId);
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { firebaseUserId: userId },
        });
        stripeCustomerId = customer.id;
        
        // Save customer ID
        await db.collection('wallets').doc(userId).set({
          stripeCustomerId,
          balance: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // Create Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'payment',
        payment_method_types: ['card', 'sepa_debit'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Strafkonto Einzahlung',
              description: `Einzahlung von ${amount.toFixed(2)}€ auf dein Strafkonto`,
            },
            unit_amount: Math.round(amount * 100), // Stripe uses cents
          },
          quantity: 1,
        }],
        metadata: {
          userId,
          type: 'deposit',
        },
        success_url: `${req.headers.origin}/wallet?deposit=success`,
        cancel_url: `${req.headers.origin}/wallet?deposit=cancelled`,
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: unknown) {
      console.error('createCheckoutSession error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 2. STRIPE WEBHOOK (Handle Payment Success)
// ============================================================================

export const stripeWebhook = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] })
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      res.status(400).send('Missing signature or webhook secret');
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('Webhook signature verification failed:', message);
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, type } = session.metadata || {};

      if (userId && type === 'deposit' && session.payment_status === 'paid') {
        const amount = (session.amount_total || 0) / 100; // Convert from cents

        // Update wallet balance
        await db.collection('wallets').doc(userId).update({
          balance: admin.firestore.FieldValue.increment(amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log transaction
        await db.collection('transactions').add({
          userId,
          type: 'deposit',
          amount,
          description: 'Einzahlung via Stripe',
          stripePaymentIntentId: session.payment_intent,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Deposited €${amount} for user ${userId}`);
      }
    }

    res.json({ received: true });
  });

// ============================================================================
// 3. PROCESS PENALTY (Deduct & Notify)
// ============================================================================

export const processPenalty = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY', 'SENDGRID_API_KEY'] })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const { targetApp, blockType, penaltyAmount } = req.body;

      // Get wallet data
      const walletDoc = await db.collection('wallets').doc(userId).get();
      const wallet = walletDoc.data() as WalletData | undefined;

      if (!wallet) {
        res.status(404).json({ error: 'Wallet not found' });
        return;
      }

      if (wallet.balance < penaltyAmount) {
        res.status(400).json({ error: 'Insufficient balance', balance: wallet.balance });
        return;
      }

      // Deduct penalty
      const actualAmount = Math.min(penaltyAmount, wallet.balance);
      const label = blockType === 'website' ? 'Website' : blockType === 'search' ? 'Suchbegriff' : 'App';
      const description = `Strafe: ${label} "${targetApp}" genutzt`;

      // Update balance
      await db.collection('wallets').doc(userId).update({
        balance: admin.firestore.FieldValue.increment(-actualAmount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log transaction
      const txRef = await db.collection('transactions').add({
        userId,
        type: 'penalty',
        amount: actualAmount,
        description,
        targetApp,
        notificationSent: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send email notification to accountability partner
      if (wallet.accountabilityPartner?.notifyOnPenalty) {
        await sendPenaltyNotificationEmail(
          wallet.accountabilityPartner,
          actualAmount,
          targetApp,
          blockType,
          userId
        );

        // Mark notification as sent
        await txRef.update({ notificationSent: true });
      }

      res.json({
        success: true,
        newBalance: wallet.balance - actualAmount,
        transactionId: txRef.id,
      });
    } catch (error: unknown) {
      console.error('processPenalty error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// HELPER: Send Email Notification
// ============================================================================

async function sendPenaltyNotificationEmail(
  partner: WalletData['accountabilityPartner'],
  amount: number,
  targetApp: string,
  blockType: string,
  userId: string
): Promise<void> {
  if (!partner) return;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const user = await admin.auth().getUser(userId);
  const userName = user.displayName || user.email || 'Dein Klient';
  const label = blockType === 'website' ? 'eine blockierte Website' : blockType === 'search' ? 'einen blockierten Suchbegriff' : 'eine blockierte App';

  const msg = {
    to: partner.email,
    from: 'noreply@yourapp.com', // Muss in SendGrid verifiziert sein
    subject: `💸 Strafzahlung eingegangen - ${userName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Neue Strafzahlung</h2>
        <p>Hallo ${partner.name},</p>
        <p><strong>${userName}</strong> hat ${label} genutzt:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            <strong>App/Website:</strong> ${targetApp}<br>
            <strong>Strafbetrag:</strong> ${amount.toFixed(2)}€
          </p>
        </div>
        <p style="font-size: 12px; color: #888;">
          Diese E-Mail wurde automatisch vom Strafkonto-System gesendet.
        </p>
      </div>
    `,
  };

  await sgMail.send(msg);
  console.log(`Penalty notification sent to ${partner.email}`);
}

// ============================================================================
// 4. GET WALLET DATA
// ============================================================================

export const getWallet = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const walletDoc = await db.collection('wallets').doc(userId).get();

      if (!walletDoc.exists) {
        // Create new wallet
        const newWallet: Partial<WalletWriteData> = {
          userId,
          balance: 0,
          stripeCustomerId: null,
          accountabilityPartner: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection('wallets').doc(userId).set(newWallet);
        res.json({ wallet: { ...newWallet, balance: 0 }, transactions: [] });
        return;
      }

      // Get recent transactions
      const txSnapshot = await db.collection('transactions')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const transactions = txSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({
        wallet: walletDoc.data(),
        transactions,
      });
    } catch (error: unknown) {
      console.error('getWallet error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 5. UPDATE ACCOUNTABILITY PARTNER
// ============================================================================

export const updateAccountabilityPartner = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const { partner } = req.body as { partner?: AccountabilityPartnerInput | null };

      // Validate partner data
      if (partner) {
        if (!partner.name || !partner.email || !partner.iban) {
          res.status(400).json({ error: 'Name, email, and IBAN are required' });
          return;
        }

        // Basic IBAN validation
        const cleanIban = partner.iban.replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleanIban)) {
          res.status(400).json({ error: 'Invalid IBAN format' });
          return;
        }

        partner.iban = cleanIban;
      }

      await db.collection('wallets').doc(userId).update({
        accountabilityPartner: partner || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true });
    } catch (error: unknown) {
      console.error('updateAccountabilityPartner error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 6. IMPORT DECK
// ============================================================================

export const importDeck = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const rows: LearningImportRow[] = req.body.notes || [];
      const createdDeckIds: string[] = [];

      for (const row of rows) {
        const deckName = row.deck || 'Imported Deck';
        const deckRef = db.collection('decks').doc(`${userId}_${deckName.replace(/\s+/g, '_').toLowerCase()}`);
        const deckSnapshot = await deckRef.get();

        if (!deckSnapshot.exists) {
          await deckRef.set({
            userId,
            name: deckName,
            description: `Importiert aus ${row.type || 'basic'} Karten`,
            language: row.language || 'de',
            tags: row.tags || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          createdDeckIds.push(deckRef.id);
        }

        const noteRef = db.collection('notes').doc();
        const cardRef = db.collection('cards').doc();
        await noteRef.set({
          userId,
          deckId: deckRef.id,
          type: row.type || 'basic',
          front: row.front,
          back: row.back,
          clozeText: row.clozeText || '',
          expectedAnswer: row.expectedAnswer || row.back,
          tags: row.tags || [],
          language: row.language || 'de',
          mediaUrl: row.mediaUrl || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await cardRef.set({
          userId,
          deckId: deckRef.id,
          noteId: noteRef.id,
          type: row.type || 'basic',
          state: 'new',
          dueAt: Date.now(),
          intervalDays: 0,
          easeFactor: 2.5,
          reps: 0,
          lapses: 0,
          stepIndex: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const deckSnapshot = await db.collection('decks').where('userId', '==', userId).get();
      res.json({
        decks: deckSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        createdDeckIds,
      });
    } catch (error: unknown) {
      console.error('importDeck error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 7. GET DUE CARDS
// ============================================================================

export const getDueCards = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const { deckIds = [] } = req.body as { deckIds?: string[] };
      let query: FirebaseFirestore.Query = db.collection('cards').where('userId', '==', userId);

      if (deckIds.length > 0) {
        query = query.where('deckId', 'in', deckIds.slice(0, 10));
      }

      const snapshot = await query.get();
      const now = Date.now();
      const cards = snapshot.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<CardRecord, 'id'>) }))
        .filter((card) => (card.dueAt || 0) <= now)
        .sort((left, right) => (left.dueAt || 0) - (right.dueAt || 0));

      res.json({ cards });
    } catch (error: unknown) {
      console.error('getDueCards error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 8. SUBMIT REVIEW BATCH
// ============================================================================

export const submitReviewBatch = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const { reviews = [] } = req.body as { reviews?: ReviewInput[] };
      const logs: Array<ReviewLog & { id: string }> = [];

      for (const review of reviews) {
        const cardRef = db.collection('cards').doc(review.cardId);
        const cardDoc = await cardRef.get();
        if (!cardDoc.exists) continue;

        const card = cardDoc.data() as CardRecord | undefined;
        if (!card) continue;
        if (card.userId !== userId) continue;

        const nextState = review.wasCorrect ? 'review' : 'relearning';
        await cardRef.update({
          state: nextState,
          dueAt: review.wasCorrect ? Date.now() + 24 * 60 * 60 * 1000 : Date.now() + 10 * 60 * 1000,
          reps: admin.firestore.FieldValue.increment(1),
          lastReviewedAt: Date.now(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const log: ReviewLog = {
          userId,
          cardId: review.cardId,
          deckId: card.deckId,
          rating: review.rating,
          wasCorrect: review.wasCorrect,
          reviewedAt: Date.now(),
          previousState: card.state,
          newState: nextState,
        };
        const logRef = await db.collection('reviewLogs').add(log);
        logs.push({ id: logRef.id, ...log });
      }

      res.json({ logs });
    } catch (error: unknown) {
      console.error('submitReviewBatch error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 9. ASSIGN DECK TO TARGET
// ============================================================================

export const assignDeckToTarget = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const { targetId, targetType, deckId } = req.body;

      await db.collection('blockedTargetPolicies').doc(`${userId}_${targetId}`).set({
        userId,
        targetId,
        targetType,
        deckId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      res.json({ success: true });
    } catch (error: unknown) {
      console.error('assignDeckToTarget error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 10. CREATE UNLOCK GRANT
// ============================================================================

export const createUnlockGrant = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const { targetId, targetType, deckId } = req.body;

      await db.collection('unlockGrants').add({
        userId,
        targetId,
        targetType,
        deckId,
        grantedAt: Date.now(),
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      res.json({ success: true });
    } catch (error: unknown) {
      console.error('createUnlockGrant error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 11. GET DEVICE POLICY
// ============================================================================

export const getDevicePolicy = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const policies = await db.collection('blockedTargetPolicies').where('userId', '==', userId).get();
      const snapshot = await db.collection('deviceSnapshots').doc(userId).get();

      res.json({
        assignments: policies.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        gateRule: snapshot.data()?.gateRule || { requiredCorrectReviews: 5, unlockDurationMinutes: 15 },
      });
    } catch (error: unknown) {
      console.error('getDevicePolicy error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

// ============================================================================
// 12. SYNC CLIENT STATE
// ============================================================================

export const syncClientState = functions
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const userId = await verifyAuthToken(req);
      const { assignments, gateRule } = req.body;

      await db.collection('deviceSnapshots').doc(userId).set({
        userId,
        assignments: assignments || [],
        gateRule: gateRule || { requiredCorrectReviews: 5, unlockDurationMinutes: 15 },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      res.json({ success: true });
    } catch (error: unknown) {
      console.error('syncClientState error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });
