// EMVCo-compliant LankaQR Payload Generator (CBSL Sri Lanka standard)

export interface LankaQrConfig {
  merchantId: string; // Merchant ID provided by bank (e.g. Commercial Bank, Sampath, BOC)
  merchantName: string; // e.g. "FIDO LK"
  merchantCity: string; // e.g. "COLOMBO"
  merchantCategoryCode?: string; // Default: 5999 (General Retail)
  terminalId?: string; // Optional POS terminal identifier
}

// TLV (Tag-Length-Value) Helper
function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

// CRC-16/CCITT-FALSE (Polynomial 0x1021, Initial 0xFFFF)
export function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generateLankaQrPayload(
  config: LankaQrConfig,
  amountInCents: number,
  invoiceRef?: string,
): string {
  let payload = "";

  // 00: Payload Format Indicator (Fixed "01")
  payload += tlv("00", "01");

  // 01: Point of Initiation Method ("12" = Dynamic with specific amount)
  payload += tlv("01", "12");

  // 26: Merchant Account Information (LankaClear / LankaPay GUID)
  const merchantSubTlv =
    tlv("00", "lk.lankapay") +
    tlv("01", config.merchantId.trim() || "000000000000");
  payload += tlv("26", merchantSubTlv);

  // 52: Merchant Category Code (MCC)
  payload += tlv("52", config.merchantCategoryCode || "5999");

  // 53: Transaction Currency ("144" for Sri Lankan Rupee)
  payload += tlv("53", "144");

  // 54: Transaction Amount (Format: "123.45")
  const formattedAmount = (amountInCents / 100).toFixed(2);
  payload += tlv("54", formattedAmount);

  // 58: Country Code ("LK")
  payload += tlv("58", "LK");

  // 59: Merchant Name (Up to 25 chars)
  const safeName = (config.merchantName || "FIDO LK").slice(0, 25).trim();
  payload += tlv("59", safeName);

  // 60: Merchant City (Up to 15 chars)
  const safeCity = (config.merchantCity || "COLOMBO").slice(0, 15).trim();
  payload += tlv("60", safeCity);

  // 62: Additional Data Field (Reference Number, Terminal)
  let sub62 = "";
  if (invoiceRef) sub62 += tlv("01", invoiceRef.slice(0, 25));
  if (config.terminalId) sub62 += tlv("07", config.terminalId.slice(0, 10));
  if (sub62) payload += tlv("62", sub62);

  // 63: CRC placeholder ("6304")
  const toChecksum = payload + "6304";
  const checksum = crc16Ccitt(toChecksum);

  return toChecksum + checksum;
}
