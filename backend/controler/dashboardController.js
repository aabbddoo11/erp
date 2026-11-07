import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";
import InventoryMovement from "../models/InventoryMovement.js";

const getStartOfDay = (date = new Date()) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getStartOfMonth = (date = new Date()) => {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getSummary = async (Model, ownerId, startDate, endDate) => {
  const match = {
    owner: ownerId,
    status: "completed",
    createdAt: {
      $gte: startDate,
      $lt: endDate,
    },
  };

  if (Model.modelName === "Invoice") {
    match.deletedAt = null;
  }

  const [summary] = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: {
          $sum: Model.modelName === "Invoice" ? "$total" : "$totalCost",
        },
        paid: { $sum: "$paidAmount" },
        due: { $sum: "$dueAmount" },
      },
    },
  ]);

  return {
    count: summary?.count || 0,
    total: summary?.total || 0,
    paid: summary?.paid || 0,
    due: summary?.due || 0,
  };
};

export const getDashboard = async (req, res, next) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const now = new Date();

    const todayStart = getStartOfDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const monthStart = getStartOfMonth(now);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

    const previousMonthStart = new Date(monthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    const sevenDaysStart = new Date(todayStart);
    sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);

    const [
      todaySales,
      monthSales,
      previousMonthSales,
      monthPurchases,
      previousMonthPurchases,
      activeProductsCount,
      stockOverview,
      lowStockProducts,
      outstandingBalances,
      monthProfitData,
      topProducts,
      recentInvoices,
      recentMovements,
      salesChartData,
      cancelledInvoicesCount,
    ] = await Promise.all([
      getSummary(Invoice, ownerId, todayStart, tomorrowStart),

      getSummary(Invoice, ownerId, monthStart, nextMonthStart),

      getSummary(Invoice, ownerId, previousMonthStart, monthStart),

      getSummary(Purchase, ownerId, monthStart, nextMonthStart),

      getSummary(Purchase, ownerId, previousMonthStart, monthStart),

      Product.countDocuments({
        owner: ownerId,
        status: "active",
      }),

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
            variantsCount: { $sum: 1 },
            totalUnits: { $sum: "$variants.stock.quantity" },
            reservedUnits: {
              $sum: "$variants.stock.reservedQuantity",
            },
            inventoryCostValue: {
              $sum: {
                $multiply: [
                  "$variants.stock.quantity",
                  "$variants.costPrice",
                ],
              },
            },
            inventorySaleValue: {
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
        { $sort: { quantity: 1, name: 1 } },
        { $limit: 10 },
      ]),

      Invoice.aggregate([
        {
          $match: {
            owner: ownerId,
            status: "completed",
            deletedAt: null,
            dueAmount: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            invoicesCount: { $sum: 1 },
            totalDue: { $sum: "$dueAmount" },
          },
        },
      ]),

      Invoice.aggregate([
        {
          $match: {
            owner: ownerId,
            status: "completed",
            deletedAt: null,
            createdAt: {
              $gte: monthStart,
              $lt: nextMonthStart,
            },
          },
        },
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

      Invoice.aggregate([
        {
          $match: {
            owner: ownerId,
            status: "completed",
            deletedAt: null,
            createdAt: {
              $gte: monthStart,
              $lt: nextMonthStart,
            },
          },
        },
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
            profit: {
              $subtract: ["$revenue", "$cost"],
            },
          },
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 10 },
      ]),

      Invoice.find({
        owner: ownerId,
        deletedAt: null,
      })
        .select(
          "invoiceNumber customer total paidAmount dueAmount status paymentStatus createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(8),

      InventoryMovement.find({
        owner: ownerId,
      })
        .select(
          "type quantityChange stockBefore stockAfter snapshot invoice purchase createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("invoice", "invoiceNumber")
        .populate("purchase", "purchaseNumber"),

      Invoice.aggregate([
        {
          $match: {
            owner: ownerId,
            status: "completed",
            deletedAt: null,
            createdAt: {
              $gte: sevenDaysStart,
              $lt: tomorrowStart,
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Africa/Cairo",
              },
            },
            sales: { $sum: "$total" },
            invoicesCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Invoice.countDocuments({
        owner: ownerId,
        status: "cancelled",
        deletedAt: null,
        cancelledAt: {
          $gte: monthStart,
          $lt: nextMonthStart,
        },
      }),
    ]);

    const stock = stockOverview[0] || {};

    const outstanding = outstandingBalances[0] || {
      invoicesCount: 0,
      totalDue: 0,
    };

    const monthCogs = monthProfitData[0]?.costOfGoodsSold || 0;

    const salesGrowth =
      previousMonthSales.total > 0
        ? Number(
            (
              ((monthSales.total - previousMonthSales.total) /
                previousMonthSales.total) *
              100
            ).toFixed(2)
          )
        : null;

    const purchasesGrowth =
      previousMonthPurchases.total > 0
        ? Number(
            (
              ((monthPurchases.total - previousMonthPurchases.total) /
                previousMonthPurchases.total) *
              100
            ).toFixed(2)
          )
        : null;

    return res.status(200).json({
      generatedAt: now,

      sales: {
        today: todaySales,
        month: monthSales,
        previousMonth: previousMonthSales,
        monthGrowthPercent: salesGrowth,
        cancelledInvoicesThisMonth: cancelledInvoicesCount,
      },

      purchases: {
        month: monthPurchases,
        previousMonth: previousMonthPurchases,
        monthGrowthPercent: purchasesGrowth,
      },

      profit: {
        monthRevenue: monthSales.total,
        monthCostOfGoodsSold: monthCogs,
        monthGrossProfit: monthSales.total - monthCogs,
      },

      receivables: {
        invoicesCount: outstanding.invoicesCount,
        totalDue: outstanding.totalDue,
      },

      inventory: {
        activeProductsCount,
        variantsCount: stock.variantsCount || 0,
        totalUnits: stock.totalUnits || 0,
        reservedUnits: stock.reservedUnits || 0,
        availableUnits:
          (stock.totalUnits || 0) - (stock.reservedUnits || 0),
        inventoryCostValue: stock.inventoryCostValue || 0,
        inventorySaleValue: stock.inventorySaleValue || 0,
        potentialInventoryProfit:
          (stock.inventorySaleValue || 0) -
          (stock.inventoryCostValue || 0),
        lowStockCount: lowStockProducts.length,
        lowStockProducts,
      },

      topProducts,
      recentInvoices,
      recentMovements,
      salesChart: salesChartData.map((item) => ({
        date: item._id,
        sales: item.sales,
        invoicesCount: item.invoicesCount,
      })),
    });
  } catch (error) {
    next(error);
  }
};