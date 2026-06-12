package app.blearn.mobile;

import java.util.Arrays;

final class DnsPacketCodec {
    static final class DnsQuery {
        final int ipVersion;
        final byte[] sourceAddress;
        final byte[] destinationAddress;
        final int sourcePort;
        final int destinationPort;
        final byte[] dnsPayload;
        final String questionName;

        DnsQuery(
            int ipVersion,
            byte[] sourceAddress,
            byte[] destinationAddress,
            int sourcePort,
            int destinationPort,
            byte[] dnsPayload,
            String questionName
        ) {
            this.ipVersion = ipVersion;
            this.sourceAddress = sourceAddress;
            this.destinationAddress = destinationAddress;
            this.sourcePort = sourcePort;
            this.destinationPort = destinationPort;
            this.dnsPayload = dnsPayload;
            this.questionName = questionName;
        }
    }

    private static final int IPV4_HEADER_BYTES = 20;
    private static final int IPV6_HEADER_BYTES = 40;
    private static final int UDP_HEADER_BYTES = 8;

    private DnsPacketCodec() {
    }

    static DnsQuery parseDnsQuery(byte[] packet, int length) {
        if (packet == null || length < UDP_HEADER_BYTES + 12) {
            return null;
        }

        int version = (packet[0] >> 4) & 0x0F;
        if (version == 4) {
            return parseIpv4DnsQuery(packet, length);
        }
        if (version == 6) {
            return parseIpv6DnsQuery(packet, length);
        }
        return null;
    }

    private static DnsQuery parseIpv4DnsQuery(byte[] packet, int length) {
        if (length < IPV4_HEADER_BYTES + UDP_HEADER_BYTES + 12) {
            return null;
        }

        int ipHeaderLength = (packet[0] & 0x0F) * 4;
        if (ipHeaderLength < IPV4_HEADER_BYTES || length < ipHeaderLength + UDP_HEADER_BYTES + 12) {
            return null;
        }

        int totalLength = Math.min(length, readUnsignedShort(packet, 2));
        if (totalLength < ipHeaderLength + UDP_HEADER_BYTES + 12) {
            return null;
        }

        int protocol = packet[9] & 0xFF;
        if (protocol != 17) {
            return null;
        }

        int udpOffset = ipHeaderLength;
        int sourcePort = readUnsignedShort(packet, udpOffset);
        int destinationPort = readUnsignedShort(packet, udpOffset + 2);
        int udpLength = readUnsignedShort(packet, udpOffset + 4);
        if (destinationPort != 53 || udpLength < UDP_HEADER_BYTES + 12) {
            return null;
        }

        int dnsOffset = udpOffset + UDP_HEADER_BYTES;
        int dnsLength = Math.min(totalLength - dnsOffset, udpLength - UDP_HEADER_BYTES);
        if (dnsLength < 12) {
            return null;
        }

        int flags = readUnsignedShort(packet, dnsOffset + 2);
        if ((flags & 0x8000) != 0) {
            return null;
        }

        int questionCount = readUnsignedShort(packet, dnsOffset + 4);
        if (questionCount < 1) {
            return null;
        }

        String questionName = readQuestionName(packet, dnsOffset + 12, dnsOffset + dnsLength);
        if (!PolicySnapshot.hasText(questionName)) {
            return null;
        }

        return new DnsQuery(
            4,
            Arrays.copyOfRange(packet, 12, 16),
            Arrays.copyOfRange(packet, 16, 20),
            sourcePort,
            destinationPort,
            Arrays.copyOfRange(packet, dnsOffset, dnsOffset + dnsLength),
            questionName
        );
    }

    private static DnsQuery parseIpv6DnsQuery(byte[] packet, int length) {
        if (length < IPV6_HEADER_BYTES + UDP_HEADER_BYTES + 12) {
            return null;
        }

        int payloadLength = readUnsignedShort(packet, 4);
        int totalLength = Math.min(length, IPV6_HEADER_BYTES + payloadLength);
        if (totalLength < IPV6_HEADER_BYTES + UDP_HEADER_BYTES + 12) {
            return null;
        }

        int nextHeader = packet[6] & 0xFF;
        if (nextHeader != 17) {
            return null;
        }

        int udpOffset = IPV6_HEADER_BYTES;
        int sourcePort = readUnsignedShort(packet, udpOffset);
        int destinationPort = readUnsignedShort(packet, udpOffset + 2);
        int udpLength = readUnsignedShort(packet, udpOffset + 4);
        if (destinationPort != 53 || udpLength < UDP_HEADER_BYTES + 12) {
            return null;
        }

        int dnsOffset = udpOffset + UDP_HEADER_BYTES;
        int dnsLength = Math.min(totalLength - dnsOffset, udpLength - UDP_HEADER_BYTES);
        if (dnsLength < 12) {
            return null;
        }

        int flags = readUnsignedShort(packet, dnsOffset + 2);
        if ((flags & 0x8000) != 0) {
            return null;
        }

        int questionCount = readUnsignedShort(packet, dnsOffset + 4);
        if (questionCount < 1) {
            return null;
        }

        String questionName = readQuestionName(packet, dnsOffset + 12, dnsOffset + dnsLength);
        if (!PolicySnapshot.hasText(questionName)) {
            return null;
        }

        return new DnsQuery(
            6,
            Arrays.copyOfRange(packet, 8, 24),
            Arrays.copyOfRange(packet, 24, 40),
            sourcePort,
            destinationPort,
            Arrays.copyOfRange(packet, dnsOffset, dnsOffset + dnsLength),
            questionName
        );
    }

    static byte[] buildBlockedDnsResponse(DnsQuery query) {
        return buildDnsErrorResponse(query, 0x0003);
    }

    static byte[] buildServfailDnsResponse(DnsQuery query) {
        return buildDnsErrorResponse(query, 0x0002);
    }

    static byte[] buildUdpResponse(DnsQuery query, byte[] dnsPayload) {
        if (query.ipVersion == 6) {
            return buildIpv6UdpResponse(query, dnsPayload);
        }
        return buildIpv4UdpResponse(query, dnsPayload);
    }

    private static byte[] buildIpv4UdpResponse(DnsQuery query, byte[] dnsPayload) {
        int totalLength = IPV4_HEADER_BYTES + UDP_HEADER_BYTES + dnsPayload.length;
        byte[] packet = new byte[totalLength];

        packet[0] = 0x45;
        packet[1] = 0;
        writeUnsignedShort(packet, 2, totalLength);
        writeUnsignedShort(packet, 4, 0);
        writeUnsignedShort(packet, 6, 0);
        packet[8] = 64;
        packet[9] = 17;
        System.arraycopy(query.destinationAddress, 0, packet, 12, 4);
        System.arraycopy(query.sourceAddress, 0, packet, 16, 4);

        int udpOffset = IPV4_HEADER_BYTES;
        writeUnsignedShort(packet, udpOffset, query.destinationPort);
        writeUnsignedShort(packet, udpOffset + 2, query.sourcePort);
        writeUnsignedShort(packet, udpOffset + 4, UDP_HEADER_BYTES + dnsPayload.length);
        writeUnsignedShort(packet, udpOffset + 6, 0);
        System.arraycopy(dnsPayload, 0, packet, udpOffset + UDP_HEADER_BYTES, dnsPayload.length);

        writeUnsignedShort(packet, 10, checksum(packet, 0, IPV4_HEADER_BYTES));
        writeUnsignedShort(
            packet,
            udpOffset + 6,
            udpChecksum(packet, query.destinationAddress, query.sourceAddress, udpOffset, UDP_HEADER_BYTES + dnsPayload.length)
        );
        return packet;
    }

    private static byte[] buildIpv6UdpResponse(DnsQuery query, byte[] dnsPayload) {
        int udpLength = UDP_HEADER_BYTES + dnsPayload.length;
        int totalLength = IPV6_HEADER_BYTES + udpLength;
        byte[] packet = new byte[totalLength];

        packet[0] = 0x60;
        writeUnsignedShort(packet, 4, udpLength);
        packet[6] = 17;
        packet[7] = 64;
        System.arraycopy(query.destinationAddress, 0, packet, 8, 16);
        System.arraycopy(query.sourceAddress, 0, packet, 24, 16);

        int udpOffset = IPV6_HEADER_BYTES;
        writeUnsignedShort(packet, udpOffset, query.destinationPort);
        writeUnsignedShort(packet, udpOffset + 2, query.sourcePort);
        writeUnsignedShort(packet, udpOffset + 4, udpLength);
        writeUnsignedShort(packet, udpOffset + 6, 0);
        System.arraycopy(dnsPayload, 0, packet, udpOffset + UDP_HEADER_BYTES, dnsPayload.length);

        writeUnsignedShort(
            packet,
            udpOffset + 6,
            udpChecksumIpv6(packet, query.destinationAddress, query.sourceAddress, udpOffset, udpLength)
        );
        return packet;
    }

    private static String readQuestionName(byte[] packet, int offset, int limit) {
        StringBuilder name = new StringBuilder();
        int cursor = offset;

        while (cursor < limit) {
            int labelLength = packet[cursor] & 0xFF;
            if (labelLength == 0) {
                return name.toString().toLowerCase();
            }

            cursor += 1;
            if (cursor + labelLength > limit) {
                return "";
            }

            if (name.length() > 0) {
                name.append('.');
            }

            for (int index = 0; index < labelLength; index += 1) {
                name.append((char) (packet[cursor + index] & 0xFF));
            }

            cursor += labelLength;
        }

        return "";
    }

    private static byte[] buildDnsErrorResponse(DnsQuery query, int rcode) {
        byte[] response = Arrays.copyOf(query.dnsPayload, query.dnsPayload.length);
        int originalFlags = readUnsignedShort(response, 2);
        int responseFlags = (originalFlags | 0x8000 | 0x0080) & 0xFFF0;
        responseFlags = (responseFlags & 0xFFF0) | (rcode & 0x000F);
        writeUnsignedShort(response, 2, responseFlags);
        writeUnsignedShort(response, 6, 0);
        writeUnsignedShort(response, 8, 0);
        writeUnsignedShort(response, 10, 0);
        return response;
    }

    private static int checksum(byte[] packet, int offset, int length) {
        long sum = 0L;
        int cursor = offset;

        while (length > 1) {
            sum += readUnsignedShort(packet, cursor);
            cursor += 2;
            length -= 2;
        }

        if (length > 0) {
            sum += (packet[cursor] & 0xFF) << 8;
        }

        while ((sum >> 16) != 0) {
            sum = (sum & 0xFFFF) + (sum >> 16);
        }

        return (int) (~sum) & 0xFFFF;
    }

    private static int udpChecksum(byte[] packet, byte[] sourceAddress, byte[] destinationAddress, int udpOffset, int udpLength) {
        long sum = 0L;

        for (int index = 0; index < 4; index += 2) {
            sum += ((sourceAddress[index] & 0xFF) << 8) | (sourceAddress[index + 1] & 0xFF);
            sum += ((destinationAddress[index] & 0xFF) << 8) | (destinationAddress[index + 1] & 0xFF);
        }

        sum += 17;
        sum += udpLength;

        int cursor = udpOffset;
        int remaining = udpLength;
        while (remaining > 1) {
            sum += readUnsignedShort(packet, cursor);
            cursor += 2;
            remaining -= 2;
        }

        if (remaining > 0) {
            sum += (packet[cursor] & 0xFF) << 8;
        }

        while ((sum >> 16) != 0) {
            sum = (sum & 0xFFFF) + (sum >> 16);
        }

        int checksum = (int) (~sum) & 0xFFFF;
        return checksum == 0 ? 0xFFFF : checksum;
    }

    private static int udpChecksumIpv6(
        byte[] packet,
        byte[] sourceAddress,
        byte[] destinationAddress,
        int udpOffset,
        int udpLength
    ) {
        long sum = 0L;

        for (int index = 0; index < 16; index += 2) {
            sum += ((sourceAddress[index] & 0xFF) << 8) | (sourceAddress[index + 1] & 0xFF);
            sum += ((destinationAddress[index] & 0xFF) << 8) | (destinationAddress[index + 1] & 0xFF);
        }

        sum += (udpLength >> 16) & 0xFFFF;
        sum += udpLength & 0xFFFF;
        sum += 17;

        int cursor = udpOffset;
        int remaining = udpLength;
        while (remaining > 1) {
            sum += readUnsignedShort(packet, cursor);
            cursor += 2;
            remaining -= 2;
        }

        if (remaining > 0) {
            sum += (packet[cursor] & 0xFF) << 8;
        }

        while ((sum >> 16) != 0) {
            sum = (sum & 0xFFFF) + (sum >> 16);
        }

        int checksum = (int) (~sum) & 0xFFFF;
        return checksum == 0 ? 0xFFFF : checksum;
    }

    private static int readUnsignedShort(byte[] value, int offset) {
        return ((value[offset] & 0xFF) << 8) | (value[offset + 1] & 0xFF);
    }

    private static void writeUnsignedShort(byte[] value, int offset, int number) {
        value[offset] = (byte) ((number >> 8) & 0xFF);
        value[offset + 1] = (byte) (number & 0xFF);
    }
}
