import React from "react";
import { LogisticsDashboard } from "../../src/features/admin/components/LogisticsDashboard";
import ErrorBoundary from "../../src/components/ErrorBoundary";

export default function LogisticsScreen() {
  return (
    <ErrorBoundary>
      <LogisticsDashboard />
    </ErrorBoundary>
  );
}
