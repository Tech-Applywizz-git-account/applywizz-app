/**
 * Deep linking + query param map for every mobile screen.
 * Scheme: invoices://… and https expo linking.
 */
import Constants from "expo-constants";
import runtimeConfig from "../config/runtimeConfig";

const { buildAuthScreens } = runtimeConfig;
const allowSelfRegistration = Boolean(
  (Constants.expoConfig?.extra || Constants.manifest?.extra)?.allowSelfRegistration,
);

export const linking = {
  prefixes: ["invoices://", "exp://"],
  config: {
    screens: {
      ...buildAuthScreens({ Login: "login" }, allowSelfRegistration),
      Tabs: {
        path: "",
        screens: {
          Home: "home",
          Invoices: "invoices",
          WhatsApp: "whatsapp",
          Incentives: "incentives",
          Settings: "settings",
        },
      },
      InvoiceDetail: "invoices/:id",
      InvoiceEditor: "invoices/new",
      CreateBilling: "billing/create",
      InvoiceRequests: "invoice-requests",
      ExternalPaidRequests: "external-paid",
      CreateExternalPaid: "external-paid/create",
      Coupons: "coupons",
      Services: "services",
      InvoiceTerms: "invoice-terms",
      Users: "users",
      Departments: "departments",
      Hierarchy: "hierarchy",
      Roles: "roles",
      NetworkLog: "network-log",
      Reports: "reports",
      Clients: "clients",
      ClientDetail: "clients/:id",
      ClientEditor: "clients/edit",
      Expenses: "expenses",
      ExpenseEditor: "expenses/edit",
      Projects: "projects",
      TimeEntries: "time-entries",
      PriceBook: "price-book",
      Contracts: "contracts",
      Calendar: "calendar",
      ReportTransactions: "reports/transactions",
    },
  },
};

export default linking;
