package app.blearn.mobile;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class DnsPacketCodecTest {
    @Test
    public void parsesDnsQueryAndBuildsServfailResponse() {
        byte[] packet = buildIpv4DnsQueryPacket();

        DnsPacketCodec.DnsQuery query = DnsPacketCodec.parseDnsQuery(packet, packet.length);

        assertNotNull(query);
        assertEquals(4, query.ipVersion);
        assertEquals("example.com", query.questionName);
        assertArrayEquals(new byte[] {10, 7, 0, 10}, query.sourceAddress);
        assertArrayEquals(new byte[] {1, 1, 1, 1}, query.destinationAddress);

        byte[] response = DnsPacketCodec.buildServfailDnsResponse(query);

        assertEquals(0x1234, readUnsignedShort(response, 0));
        assertTrue((readUnsignedShort(response, 2) & 0x8000) != 0);
        assertEquals(2, readUnsignedShort(response, 2) & 0x000F);
        assertEquals(0, readUnsignedShort(response, 6));
        assertEquals(0, readUnsignedShort(response, 8));
        assertEquals(0, readUnsignedShort(response, 10));
    }

    @Test
    public void buildsUdpResponseWithSwappedEndpoints() {
        DnsPacketCodec.DnsQuery query = new DnsPacketCodec.DnsQuery(
            4,
            new byte[] {10, 7, 0, 10},
            new byte[] {1, 1, 1, 1},
            12_345,
            53,
            new byte[] {0x12, 0x34, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0},
            "example.com"
        );

        byte[] payload = DnsPacketCodec.buildServfailDnsResponse(query);
        byte[] packet = DnsPacketCodec.buildUdpResponse(query, payload);

        assertEquals(20 + 8 + payload.length, packet.length);
        assertEquals(53, readUnsignedShort(packet, 20));
        assertEquals(12_345, readUnsignedShort(packet, 22));
        assertArrayEquals(new byte[] {1, 1, 1, 1}, new byte[] {packet[12], packet[13], packet[14], packet[15]});
        assertArrayEquals(new byte[] {10, 7, 0, 10}, new byte[] {packet[16], packet[17], packet[18], packet[19]});
    }

    @Test
    public void parsesIpv6DnsQueryAndBuildsIpv6UdpResponse() {
        byte[] packet = buildIpv6DnsQueryPacket();

        DnsPacketCodec.DnsQuery query = DnsPacketCodec.parseDnsQuery(packet, packet.length);

        assertNotNull(query);
        assertEquals(6, query.ipVersion);
        assertEquals("example.com", query.questionName);
        assertArrayEquals(
            new byte[] {
                0x20, 0x01, 0x0d, (byte) 0xb8, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0x10
            },
            query.sourceAddress
        );
        assertArrayEquals(
            new byte[] {
                0x26, 0x06, 0x47, 0x00, 0x47, 0x00, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0x11
            },
            query.destinationAddress
        );

        byte[] response = DnsPacketCodec.buildUdpResponse(query, DnsPacketCodec.buildServfailDnsResponse(query));

        assertEquals(0x60, response[0] & 0xF0);
        assertEquals(17, response[6] & 0xFF);
        assertEquals(53, readUnsignedShort(response, 40));
        assertEquals(12_345, readUnsignedShort(response, 42));
        assertArrayEquals(query.destinationAddress, java.util.Arrays.copyOfRange(response, 8, 24));
        assertArrayEquals(query.sourceAddress, java.util.Arrays.copyOfRange(response, 24, 40));
    }

    private static byte[] buildIpv4DnsQueryPacket() {
        byte[] dnsPayload = buildDnsPayload();
        int totalLength = 20 + 8 + dnsPayload.length;
        byte[] packet = new byte[totalLength];

        packet[0] = 0x45;
        writeUnsignedShort(packet, 2, totalLength);
        packet[8] = 64;
        packet[9] = 17;
        packet[12] = 10;
        packet[13] = 7;
        packet[14] = 0;
        packet[15] = 10;
        packet[16] = 1;
        packet[17] = 1;
        packet[18] = 1;
        packet[19] = 1;

        int udpOffset = 20;
        writeUnsignedShort(packet, udpOffset, 12_345);
        writeUnsignedShort(packet, udpOffset + 2, 53);
        writeUnsignedShort(packet, udpOffset + 4, 8 + dnsPayload.length);
        System.arraycopy(dnsPayload, 0, packet, udpOffset + 8, dnsPayload.length);
        return packet;
    }

    private static byte[] buildIpv6DnsQueryPacket() {
        byte[] dnsPayload = buildDnsPayload();
        int udpLength = 8 + dnsPayload.length;
        int totalLength = 40 + udpLength;
        byte[] packet = new byte[totalLength];

        packet[0] = 0x60;
        writeUnsignedShort(packet, 4, udpLength);
        packet[6] = 17;
        packet[7] = 64;

        byte[] sourceAddress = new byte[] {
            0x20, 0x01, 0x0d, (byte) 0xb8, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0x10
        };
        byte[] destinationAddress = new byte[] {
            0x26, 0x06, 0x47, 0x00, 0x47, 0x00, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0x11
        };
        System.arraycopy(sourceAddress, 0, packet, 8, sourceAddress.length);
        System.arraycopy(destinationAddress, 0, packet, 24, destinationAddress.length);

        int udpOffset = 40;
        writeUnsignedShort(packet, udpOffset, 12_345);
        writeUnsignedShort(packet, udpOffset + 2, 53);
        writeUnsignedShort(packet, udpOffset + 4, udpLength);
        System.arraycopy(dnsPayload, 0, packet, udpOffset + 8, dnsPayload.length);
        return packet;
    }

    private static byte[] buildDnsPayload() {
        byte[] question = new byte[] {
            7, 'e', 'x', 'a', 'm', 'p', 'l', 'e',
            3, 'c', 'o', 'm',
            0,
            0, 1,
            0, 1
        };
        byte[] payload = new byte[12 + question.length];
        writeUnsignedShort(payload, 0, 0x1234);
        writeUnsignedShort(payload, 2, 0x0100);
        writeUnsignedShort(payload, 4, 1);
        System.arraycopy(question, 0, payload, 12, question.length);
        return payload;
    }

    private static int readUnsignedShort(byte[] value, int offset) {
        return ((value[offset] & 0xFF) << 8) | (value[offset + 1] & 0xFF);
    }

    private static void writeUnsignedShort(byte[] value, int offset, int number) {
        value[offset] = (byte) ((number >> 8) & 0xFF);
        value[offset + 1] = (byte) (number & 0xFF);
    }
}
