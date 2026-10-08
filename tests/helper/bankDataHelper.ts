import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface SpecLabelValue {
  label: string;
  value: any;
}

export interface BankGroupedMap {
  [bankCode: string]: SpecLabelValue[];
}

export class BankDataReader {
  /**
   * Reads CSV or Excel and groups spec/value rows by bank code.
   */
  static readAndGroupBankData(filePath: string): BankGroupedMap {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    if (workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in the file.');
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false
    });

    const groupedByBank: BankGroupedMap = {};

    for (const row of rows) {
      // Normalize column headers to handle case/spacing variations
      const cleanedRow: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        const normalizedKey = key
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, '');

        cleanedRow[normalizedKey] = row[key];
      }

      const bankCode = String(cleanedRow['bank'] ?? cleanedRow['bankcode'] ?? '').trim();
      const specLabel = String(cleanedRow['spec'] ?? '').trim();
      const specValue = String(cleanedRow['value'] ?? '').trim();

      // Skip invalid or empty rows
      if (!bankCode || !specLabel) continue;

      if (!groupedByBank[bankCode]) {
        groupedByBank[bankCode] = [];
      }

      // Format as {"label": "SPEC_NAME", "value": "SPEC_VALUE"}
      groupedByBank[bankCode].push({
        label: specLabel,
        value: specValue
      });
    }

    return groupedByBank;
  }

  /**
   * Saves a single bank's spec list under a fixed "202" key to a specified file path.
   */
  static saveSingleBankFormattedJson(
    bankSpecs: SpecLabelValue[],
    outputPath: string
  ): void {
    const absolutePath = path.resolve(outputPath);
    const outputDirectory = path.dirname(absolutePath);

    // Create target folder structure if it doesn't exist
    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    // Fixed key structure as required
    const payload = {
      "202": bankSpecs
    };

    fs.writeFileSync(
      absolutePath,
      JSON.stringify(payload, null, 2),
      'utf-8'
    );

    console.log(`Saved formatted JSON to external path: ${absolutePath}`);
  }
}