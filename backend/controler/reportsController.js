import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import InventoryMovement from "../models/InventoryMovement.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getDateRange = (query) => {
  const now = new Date();

  const defaultStart = new Date(now);
  defaultStart.setDate(1);
  defaultStart.setHours(0, 0, 0, 0);

  const defaultEnd = new Date(now);
  defaultEnd.setHours(23, 59, 59, 999);

  const startDate = query.from ? new Date(query.from) : defaultStart;
  const endDate = query.to ? new Date(query.to) : defaultEnd;

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    throw createError("صيغة التاريخ غير صالحة");
  }

  endDate.setHours(23, 59, 59, 999);

  if (startDate > endDate) {
    throw createError("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
  }

  return { startDate, endDate };
};

const getCompletedInvoiceMatch = (ownerId, startDate, endDate) => ({
  owner: ownerId,
  status: "completed",
  deletedAt: null,
  createdAt: {
    $gte: startDate,
    $lte: endDate,
  },
});

export const getSalesReport = async (req, res, next) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const { startDate, endDate } = getDateRange(req.query);

    const invoiceMatch = getCompletedInvoiceMatch(
      ownerId,
      startDate,
      endDate
    );

    const [
      summaryData,
      dailySales,
      paymentMethods,
      topProducts,
      recentInvoices,
    ] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: null,
            invoicesCount: { $sum: 1 },
            totalSales: { $sum: "$total" },
            totalPaid: { $sum: "$paidAmount" },
            totalDue: { $sum: "$dueAmount" },
            totalTax: { $sum: "$taxAmount" },
            itemDiscounts: { $sum: "$itemsDiscount" },
            invoiceDiscounts: { $sum: "$invoiceDiscount" },
          },
        },
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Africa/Cairo",
              },
            },
            invoicesCount: { $sum: 1 },
            sales: { $sum: "$total" },
            paid: { $sum: "$paidAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $unwind: "$payments" },
        {
          $group: {
            _id: "$payments.method",
            transactionsCount: { $sum: 1 },
            total: { $sum: "$payments.amount" },
          },
        },
        { $sort: { total: -1 } },
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: {
              product: "$items.product",
              variant: "$items.variant",
            },
            productName: { $first: "$items.productName" },
            sku: { $first: "$items.sku" },
            color: { $first: "$items.color.name" },
            size: { $first: "$items.size.code" },
            quantitySold: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.lineTotal" },
            cost: {
              $sum: {
                $multiply: [
                  "$items.quantity",
                  "$items.unitCost",
                ],
              },
            },
          },
        },
        {
          $addFields: {
            grossProfit: {
              $subtract: ["$revenue", "$cost"],
            },
          },
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 20 },
      ]),

      Invoice.find(invoiceMatch)
        .select(
          "invoiceNumber customer total paidAmount dueAmount paymentStatus createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    const summary = summaryData[0] || {};

    return res.status(200).json({
      period: {
        from: startDate,
        to: endDate,
      },
      summary: {
        invoicesCount: summary.invoicesCount || 0,
        totalSales: summary.totalSales || 0,
        totalPaid: summary.totalPaid || 0,
        totalDue: summary.totalDue || 0,
        totalTax: summary.totalTax || 0,
        totalDiscounts:
          (summary.itemDiscounts || 0) +
          (summary.invoiceDiscounts || 0),
      },
      dailySales: dailySales.map((item) => ({
        date: item._id,
        invoicesCount: item.invoicesCount,
        sales: item.sales,
        paid: item.paid,
      })),
      paymentMethods: paymentMethods.map((item) => ({
        method: item._id,
        transactionsCount: item.transactionsCount,
        total: item.total,
      })),
      topProducts,
      recentInvoices,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfitReport = async (req, res, next) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const { startDate, endDate } = getDateRange(req.query);

    const invoiceMatch = getCompletedInvoiceMatch(
      ownerId,
      startDate,
      endDate
    );

    const purchaseMatch = {
      owner: ownerId,
      status: "completed",
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const [
      salesData,
      cogsData,
      purchasesData,
      topProfitProducts,
    ] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        {
          $group: {
            _id: null,
            salesRevenue: { $sum: "$total" },
            invoicesCount: { $sum: 1 },
          },
        },
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: null,
            costOfGoodsSold: {
              $sum: {
                $multiply: [
                  "$items.quantity",
                  "$items.unitCost",
                ],
              },
            },
          },
        },
      ]),

      Purchase.aggregate([
        { $match: purchaseMatch },
        {
          $group: {
            _id: null,
            purchasesCount: { $sum: 1 },
            purchasesCost: { $sum: "$totalCost" },
            purchasesPaid: { $sum: "$paidAmount" },
            purchasesDue: { $sum: "$dueAmount" },
          },
        },
      ]),

      Invoice.aggregate([
        { $match: invoiceMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: {
              product: "$items.product",
              variant: "$items.variant",
            },
            productName: { $first: "$items.productName" },
            sku: { $first: "$items.sku" },
            quantitySold: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.lineTotal" },
            cost: {
              $sum: {
                $multiply: [
                  "$items.quantity",
                  "$items.unitCost",
                ],
              },
            },
          },
        },
        {
          $addFields: {
            grossProfit: {
              $subtract: ["$revenue", "$cost"],
            },
            profitMarginPercent: {
              $cond: [
                { $gt: ["$revenue", 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $subtract: ["$revenue", "$cost"] },
                        "$revenue",
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { grossProfit: -1 } },
        { $limit: 20 },
      ]),
    ]);

    const sales = salesData[0] || {};
    const cogs = cogsData[0]?.costOfGoodsSold || 0;
    const purchases = purchasesData[0] || {};
    const revenue = sales.salesRevenue || 0;
    const grossProfit = revenue - cogs;

    return res.status(200).json({
      period: {
        from: startDate,
        to: endDate,
      },
      profit: {
        invoicesCount: sales.invoicesCount || 0,
        salesRevenue: revenue,
        costOfGoodsSold: cogs,
        grossProfit,
        grossProfitMarginPercent:
          revenue > 0
            ? Number(((grossProfit / revenue) * 100).toFixed(2))
            : 0,
      },
      purchases: {
        purchasesCount: purchases.purchasesCount || 0,
        purchasesCost: purchases.purchasesCost || 0,
        purchasesPaid: purchases.purchasesPaid || 0,
        purchasesDue: purchases.purchasesDue || 0,
      },
      topProfitProducts,
    });
  } catch (error) {
    next(error);
  }
};

export const getInventoryReport = async (req, res, next) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const { startDate, endDate } = getDateRange(req.query);

    const [
      inventoryData,
      lowStockProducts,
      movementSummary,
      recentMovements,
    ] = await Promise.all([
      Product.aggregate([
        {
          $match: {
            owner: ownerId,
            status: { $ne: "archived" },
          },
        },
        { $unwind: "$variants" },
        {
          $group: {
            _id: null,
            activeVariants: { $sum: 1 },
            totalUnits: { $sum: "$variants.stock.quantity" },
            reservedUnits: {
              $sum: "$variants.stock.reservedQuantity",
            },
            costValue: {
              $sum: {
                $multiply: [
                  "$variants.stock.quantity",
                  "$variants.costPrice",
                ],
              },
            },
            saleValue: {
              $sum: {
                $multiply: [
                  "$variants.stock.quantity",
                  "$variants.salePrice",
                ],
              },
            },
          },
        },
      ]),

      Product.aggregate([
        {
          $match: {
            owner: ownerId,
            status: "active",
          },
        },
        { $unwind: "$variants" },
        {
          $match: {
            $expr: {
              $lte: [
                {
                  $subtract: [
                    "$variants.stock.quantity",
                    "$variants.stock.reservedQuantity",
                  ],
                },
                "$variants.stock.reorderPoint",
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            category: 1,
            variantId: "$variants._id",
            sku: "$variants.sku",
            color: "$variants.color.name",
            size: "$variants.size.code",
            quantity: "$variants.stock.quantity",
            reservedQuantity: "$variants.stock.reservedQuantity",
            reorderPoint: "$variants.stock.reorderPoint",
          },
        },
        { $sort: { quantity: 1 } },
      ]),

      InventoryMovement.aggregate([
        {
          $match: {
            owner: ownerId,
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: "$type",
            movementsCount: { $sum: 1 },
            quantityChange: { $sum: "$quantityChange" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      InventoryMovement.find({
        owner: ownerId,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
        .select(
          "type quantityChange stockBefore stockAfter snapshot notes invoice purchase performedBy createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("invoice", "invoiceNumber")
        .populate("purchase", "purchaseNumber")
        .populate("performedBy", "name email"),
    ]);

    const inventory = inventoryData[0] || {};

    return res.status(200).json({
      period: {
        from: startDate,
        to: endDate,
      },
      summary: {
        activeVariants: inventory.activeVariants || 0,
        totalUnits: inventory.totalUnits || 0,
        reservedUnits: inventory.reservedUnits || 0,
        availableUnits:
          (inventory.totalUnits || 0) -
          (inventory.reservedUnits || 0),
        costValue: inventory.costValue || 0,
        saleValue: inventory.saleValue || 0,
        potentialProfit:
          (inventory.saleValue || 0) -
          (inventory.costValue || 0),
        lowStockCount: lowStockProducts.length,
      },
      lowStockProducts,
      movementSummary: movementSummary.map((item) => ({
        type: item._id,
        movementsCount: item.movementsCount,
        quantityChange: item.quantityChange,
      })),
      recentMovements,
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchasesReport = async (req, res, next) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const { startDate, endDate } = getDateRange(req.query);

    const match = {
      owner: ownerId,
      status: "completed",
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const [summaryData, topPurchasedProducts, recentPurchases] =
      await Promise.all([
        Purchase.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              purchasesCount: { $sum: 1 },
              totalCost: { $sum: "$totalCost" },
              paidAmount: { $sum: "$paidAmount" },
              dueAmount: { $sum: "$dueAmount" },
            },
          },
        ]),

        Purchase.aggregate([
          { $match: match },
          { $unwind: "$items" },
          {
            $group: {
              _id: {
                product: "$items.product",
                variant: "$items.variant",
              },
              productName: { $first: "$items.productName" },
              sku: { $first: "$items.sku" },
              color: { $first: "$items.color.name" },
              size: { $first: "$items.size.code" },
              quantityPurchased: { $sum: "$items.quantity" },
              totalCost: { $sum: "$items.lineTotal" },
            },
          },
          { $sort: { quantityPurchased: -1 } },
          { $limit: 20 },
        ]),

        Purchase.find(match)
          .select(
            "purchaseNumber referenceNumber totalCost paidAmount dueAmount paymentStatus createdAt"
          )
          .sort({ createdAt: -1 })
          .limit(20),
      ]);

    const summary = summaryData[0] || {};

    return res.status(200).json({
      period: {
        from: startDate,
        to: endDate,
      },
      summary: {
        purchasesCount: summary.purchasesCount || 0,
        totalCost: summary.totalCost || 0,
        paidAmount: summary.paidAmount || 0,
        dueAmount: summary.dueAmount || 0,
      },
      topPurchasedProducts,
      recentPurchases,
    });
  } catch (error) {
    next(error);
  }
};