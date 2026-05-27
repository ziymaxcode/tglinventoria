import express from "express";
import { google } from "googleapis";

const app = express();
const apiRouter = express.Router();

app.use(express.json());
apiRouter.use(express.json());

// Middleware to extract token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  req.token = token;
  next();
};

const getSheetsClient = (token: string) => {
  const oauth2Client = new google.auth.OAuth2();

  oauth2Client.setCredentials({
    access_token: token,
  });

  return google.sheets({
    version: "v4",
    auth: oauth2Client,
  });
};

// Convert rows to objects
function rowsToObjects(rows: any[]) {
  if (!rows || rows.length === 0) return [];

  const headers = rows[0];
  const data = rows.slice(1);

  return data.map((row: any[], rowIndex: number) => {
    const obj: any = {
      _rowIndex: rowIndex + 2,
    };

    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || "";
    });

    return obj;
  });
}

const parseConfigResponse = (rows: any[]) => {
  if (!rows || rows.length < 2) {
    return {
      categories: [],
      subcategories: [],
      locations: [],
      productTabs: [],
    };
  }

  const categories: string[] = [];
  const subcategories: string[] = [];
  const locations: string[] = [];
  const productTabs: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (row[0]) categories.push(row[0]);
    if (row[1]) subcategories.push(row[1]);
    if (row[2]) locations.push(row[2]);
    if (row[3]) productTabs.push(row[3]);
  }

  return {
    categories,
    subcategories,
    locations,
    productTabs,
  };
};

// ================= CONFIG ROUTES =================

// Get Config
apiRouter.get(
  "/config/:spreadsheetId",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { spreadsheetId } = req.params;

      const sheets = getSheetsClient(req.token);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "AppConfig",
      });

      const config = parseConfigResponse(response.data.values);

      res.json(config);
    } catch (error: any) {
      const msg = error.message || "";

      if (
        msg.includes("Unable to parse range") ||
        msg.includes("cannot be parsed")
      ) {
        return res.json({
          categories: [],
          subcategories: [],
          locations: [],
          productTabs: [],
        });
      }

      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// Save Config
apiRouter.post(
  "/config/:spreadsheetId",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { spreadsheetId } = req.params;

      const categories = req.body.categories || [];
      const subcategories = req.body.subcategories || [];
      const locations = req.body.locations || [];
      const productTabs = req.body.productTabs || [];

      const sheets = getSheetsClient(req.token);

      try {
        await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "AppConfig!A1",
        });
      } catch (e: any) {
        const msg = e.message || "";

        if (
          msg.includes("Unable to parse range") ||
          msg.includes("cannot be parsed")
        ) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: "AppConfig",
                    },
                  },
                },
              ],
            },
          });
        } else {
          throw e;
        }
      }

      const maxRows = Math.max(
        categories.length,
        subcategories.length,
        locations.length,
        productTabs.length
      );

      const rows = [["Category", "Subcategory", "Location", "ProductTabs"]];

      for (let i = 0; i < maxRows; i++) {
        rows.push([
          categories[i] || "",
          subcategories[i] || "",
          locations[i] || "",
          productTabs[i] || "",
        ]);
      }

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: "AppConfig!A:D",
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "AppConfig!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: rows,
        },
      });

      res.json({
        success: true,
      });
    } catch (error: any) {
      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ================= INVENTORY ROUTES =================

// Get Inventory
apiRouter.get(
  "/inventory/:spreadsheetId/:sheetName",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { spreadsheetId, sheetName } = req.params;

      const sheets = getSheetsClient(req.token);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}`,
      });

      const rows = response.data.values;

      if (!rows || rows.length === 0) {
        return res.json([]);
      }

      const items = rowsToObjects(rows);

      res.json(items);
    } catch (error: any) {
      console.error(error);

      const msg = error.message || "";

      if (
        msg.includes("Unable to parse range") ||
        msg.includes("cannot be parsed") ||
        msg.includes("cannot find sheet")
      ) {
        return res.json([]);
      }

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// Add Item
apiRouter.post(
  "/inventory/:spreadsheetId/:sheetName",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { spreadsheetId, sheetName } = req.params;

      const data = req.body;

      const sheets = getSheetsClient(req.token);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [data],
        },
      });

      res.json({
        success: true,
      });
    } catch (error: any) {
      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// Update Item
apiRouter.put(
  "/inventory/:spreadsheetId/:sheetName/:rowIndex",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { spreadsheetId, sheetName, rowIndex } = req.params;

      const data = req.body;

      const sheets = getSheetsClient(req.token);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowIndex}:AA${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [data],
        },
      });

      res.json({
        success: true,
      });
    } catch (error: any) {
      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

// Delete Item
apiRouter.delete(
  "/inventory/:spreadsheetId/:sheetName/:rowIndex",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { spreadsheetId, sheetName, rowIndex } = req.params;

      const sheets = getSheetsClient(req.token);

      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === sheetName
      );

      if (!sheet || sheet.properties?.sheetId === undefined) {
        return res.status(404).json({
          error: "Sheet not found",
        });
      }

      const sheetId = sheet.properties.sheetId;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: parseInt(rowIndex) - 1,
                  endIndex: parseInt(rowIndex),
                },
              },
            },
          ],
        },
      });

      res.json({
        success: true,
      });
    } catch (error: any) {
      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  }
);
apiRouter.get(
  "/search/:spreadsheetId",
  authenticateToken,
  async (req: any, res) => {
    try {
      const { spreadsheetId } = req.params;
      const { q, tabs } = req.query;

      if (!q || typeof q !== "string" || q.trim() === "") {
        return res.json([]);
      }

      if (!tabs || typeof tabs !== "string") {
        return res.json([]);
      }

      const sheetNames = tabs
        .split(",")
        .filter((t: string) => t.trim() !== "");

      const sheets = getSheetsClient(req.token);

      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const actualSheetNames =
        spreadsheet.data.sheets
          ?.map((s) => s.properties?.title)
          .filter(Boolean) as string[] || [];

      const validSheetNames = sheetNames.filter((name: string) =>
        actualSheetNames.includes(name)
      );

      if (validSheetNames.length === 0) {
        return res.json([]);
      }

      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: validSheetNames.map((name) => `'${name}'`),
      });

      const valueRanges = response.data.valueRanges || [];

      let allItems: any[] = [];

      valueRanges.forEach((rangeObj, index) => {
        const rows = rangeObj.values;

        if (!rows || rows.length === 0) return;

        const items = rowsToObjects(rows);

        const sheetName = validSheetNames[index];

        items.forEach((item: any) => {
          item._sheetName = sheetName;
          allItems.push(item);
        });
      });

      const query = q.toLowerCase();

      const matchedItems = allItems.filter((item) => {
        const name = (
          item["Item Name"] ||
          item.item_name ||
          ""
        ).toLowerCase();

        const code = (
          item["Item Code"] ||
          item.item_code ||
          ""
        ).toLowerCase();

        const pid = (
          item["Product ID"] ||
          item.product_id ||
          ""
        ).toLowerCase();

        const loc = (
          item["Location"] ||
          item.location ||
          ""
        ).toLowerCase();

        const initials = name
          .split(/\s+/)
          .map((w: string) => w[0])
          .join("");

        return (
          name.includes(query) ||
          code.includes(query) ||
          pid.includes(query) ||
          loc.includes(query) ||
          initials.includes(query)
        );
      });

      const aggregatedMap: Record<string, any> = {};

      matchedItems.forEach((item) => {
        const prodId =
          item["Product ID"] || item.product_id;

        const itemName =
          item["Item Name"] || item.item_name;

        const itemCode =
          item["Item Code"] || item.item_code;

        const itemStock =
          item["Stock"] || item.stock;

        const itemLocation =
          item["Location"] || item.location;

        const key = prodId || itemName || "unknown";

        if (!aggregatedMap[key]) {
          aggregatedMap[key] = {
            product_id: prodId,
            item_code: itemCode,
            item_name: itemName,
            total_stock: 0,
            locations: [],
          };
        }

        const stock = parseInt(itemStock || "0", 10);

        if (!isNaN(stock)) {
          aggregatedMap[key].total_stock += stock;
        }

        if (itemLocation) {
          aggregatedMap[key].locations.push({
            name: itemLocation,
            stock: isNaN(stock) ? 0 : stock,
            sheetName: item._sheetName,
          });
        }
      });

      res.json(Object.values(aggregatedMap));
    } catch (error: any) {
      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  }
);

app.use("/api", apiRouter);

export default app;