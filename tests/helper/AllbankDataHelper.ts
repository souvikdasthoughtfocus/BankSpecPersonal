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
   * Reads CSV or Excel file
   * and groups spec/value rows by bank code.
   *
   * Example input:
   *
   * BANK | SPEC | VALUE
   * 001  | ABC  | YES
   * 001  | XYZ  | NO
   * 002  | ABC  | NO
   * 002  | XYZ  | YES
   *
   * Result:
   *
   * {
   *   "001": [
   *     { label: "ABC", value: "YES" },
   *     { label: "XYZ", value: "NO" }
   *   ],
   *   "002": [
   *     { label: "ABC", value: "NO" },
   *     { label: "XYZ", value: "YES" }
   *   ]
   * }
   */
  static readAndGroupBankData(
    filePath: string
  ): BankGroupedMap {

    //========================================================
    // RESOLVE FILE PATH
    //========================================================

    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `Bank data file not found: ${absolutePath}`
      );
    }

    console.log(
      `Reading bank data from: ${absolutePath}`
    );

    //========================================================
    // READ FILE
    //========================================================

    const fileBuffer = fs.readFileSync(
      absolutePath
    );

    const workbook = XLSX.read(
      fileBuffer,
      {
        type: 'buffer'
      }
    );

    //========================================================
    // CHECK SHEETS
    //========================================================

    if (
      !workbook.SheetNames ||
      workbook.SheetNames.length === 0
    ) {
      throw new Error(
        'No sheets found in the bank data file.'
      );
    }

    //========================================================
    // USE FIRST SHEET
    //========================================================

    const sheetName =
      workbook.SheetNames[0];

    const sheet =
      workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error(
        `Unable to read sheet: ${sheetName}`
      );
    }

    console.log(
      `Reading sheet: ${sheetName}`
    );

    //========================================================
    // CONVERT SHEET TO JSON
    //========================================================

    const rows: Record<string, any>[] =
      XLSX.utils.sheet_to_json(
        sheet,
        {
          defval: '',
          raw: false
        }
      );

    if (rows.length === 0) {
      throw new Error(
        `No data found in sheet: ${sheetName}`
      );
    }

    console.log(
      `Total rows found: ${rows.length}`
    );

    //========================================================
    // GROUP BY BANK
    //========================================================

    const groupedByBank: BankGroupedMap = {};

    for (const row of rows) {

      //======================================================
      // NORMALIZE COLUMN NAMES
      //======================================================

      const cleanedRow: Record<string, any> = {};

      for (const key of Object.keys(row)) {

        const normalizedKey =
          key
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, '');

        cleanedRow[normalizedKey] =
          row[key];
      }

      //======================================================
      // READ BANK CODE
      //======================================================

      const bankCode =
        String(
          cleanedRow['bank'] ??
          cleanedRow['bankcode'] ??
          ''
        ).trim();

      //======================================================
      // READ SPEC
      //======================================================

      const specLabel =
        String(
          cleanedRow['spec'] ??
          ''
        ).trim();

      //======================================================
      // READ VALUE
      //======================================================

      const specValue =
        String(
          cleanedRow['value'] ??
          ''
        ).trim();

      //======================================================
      // SKIP INVALID ROWS
      //======================================================

      if (
        !bankCode ||
        !specLabel
      ) {
        continue;
      }

      //======================================================
      // CREATE BANK ENTRY
      //======================================================

      if (
        !groupedByBank[bankCode]
      ) {
        groupedByBank[bankCode] = [];
      }

      //======================================================
      // ADD SPEC/VALUE
      //======================================================

      groupedByBank[bankCode].push({
        label: specLabel,
        value: specValue
      });
    }

    //========================================================
    // LOG BANKS FOUND
    //========================================================

    const bankCodes =
      Object.keys(groupedByBank);

    console.log(
      `Total banks found: ${bankCodes.length}`
    );

    console.log(
      `Banks: ${bankCodes.join(', ')}`
    );

    return groupedByBank;
  }

  /**
   * Overwrites the JSON file with ONLY
   * the currently processed bank.
   *
   * Example:
   *
   * First iteration:
   *
   * {
   *   "001": [...]
   * }
   *
   * Next iteration:
   *
   * {
   *   "002": [...]
   * }
   *
   * The previous 001 data is completely replaced.
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