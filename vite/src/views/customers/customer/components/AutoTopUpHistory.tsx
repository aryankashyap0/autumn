import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";
import { useCusQuery } from "../hooks/useCusQuery";
import { formatUnixToDateTime } from "@/utils/formatUtils/formatDateUtils";
import { useAxiosInstance } from "@/services/useAxiosInstance";
import { useEnv } from "@/utils/envUtils";
import { toast } from "sonner";

interface AutoTopUpRecord {
  id: string;
  customer_id: string;
  product_id: string;
  threshold: number;
  top_up_amount: number;
  charged_amount: number;
  created_at: number;
  status: "pending" | "completed" | "failed";
  invoice_id?: string;
}

export const AutoTopUpHistory = () => {
  const { customer } = useCusQuery();
  const env = useEnv();
  const axiosInstance = useAxiosInstance({ env });
  const [autoTopUpHistory, setAutoTopUpHistory] = useState<AutoTopUpRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/v1/customers/${customer.id}/auto-top-up-history`);
      setAutoTopUpHistory(response.data.history || []);
    } catch (error: any) {
      console.error("Failed to fetch auto top-up history:", error);
      toast.error("Failed to load auto top-up history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [customer.id]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle size={16} className="text-green-500" />;
      case "failed":
        return <XCircle size={16} className="text-red-500" />;
      case "pending":
        return <Clock size={16} className="text-yellow-500" />;
      default:
        return <Clock size={16} className="text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="text-green-600 border-green-200">Completed</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-red-600 border-red-200">Failed</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  if (autoTopUpHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard size={16} />
            Auto Top-Up History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-500">
            <CreditCard size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No auto top-up history found</p>
            <p className="text-xs">Auto top-ups will appear here when triggered</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard size={16} />
            Auto Top-Up History
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHistory}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {autoTopUpHistory.map((record) => {
            const dateTime = formatUnixToDateTime(record.created_at);
            return (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(record.status)}
                  <div>
                    <div className="text-sm font-medium">
                      +{record.top_up_amount.toLocaleString()} credits
                    </div>
                    <div className="text-xs text-gray-500">
                      {dateTime.date} at {dateTime.time}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {record.status === "completed" && record.charged_amount > 0
                      ? formatAmount(record.charged_amount)
                      : "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Threshold: {record.threshold} credits
                  </div>
                  {getStatusBadge(record.status)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
