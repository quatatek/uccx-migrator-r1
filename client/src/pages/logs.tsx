import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/contexts/project-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Download, 
  RefreshCw, 
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  AlertCircle,
  Bug
} from "lucide-react";

interface AuditLog {
  id: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  category: 'import' | 'migration' | 'api' | 'system';
  message: string;
  source: string;
  timestamp: string;
  metadata?: any;
}

const levelConfig = {
  error: {
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertTriangle,
  },
  warning: {
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertCircle,
  },
  info: {
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Info,
  },
  debug: {
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: Bug,
  },
};

export default function Logs() {
  const { currentProjectId } = useProject();
  const [filters, setFilters] = useState({
    level: 'all',
    category: 'all',
    search: '',
    dateRange: 'last_24_hours',
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
  });

  const { data: rawLogs, isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ['/api/logs', currentProjectId, filters.level, filters.category, filters.dateRange, pagination],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (currentProjectId) params.append('projectId', currentProjectId);
      if (filters.level && filters.level !== 'all') params.append('level', filters.level);
      if (filters.category && filters.category !== 'all') params.append('category', filters.category);

      // Handle date range
      if (filters.dateRange !== 'custom') {
        const now = new Date();
        let startDate: Date;

        switch (filters.dateRange) {
          case 'last_24_hours':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'last_7_days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'last_30_days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        params.append('startDate', startDate.toISOString());
        params.append('endDate', now.toISOString());
      }

      params.append('limit', pagination.limit.toString());
      params.append('offset', pagination.offset.toString());

      const response = await fetch(`/api/logs?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 10000,
  });

  // Client-side search filtering — fast, always correct regardless of date range
  const logs = filters.search
    ? rawLogs?.filter(log => {
        const term = filters.search.toLowerCase();
        return (
          log.message?.toLowerCase().includes(term) ||
          log.source?.toLowerCase().includes(term) ||
          log.category?.toLowerCase().includes(term) ||
          log.level?.toLowerCase().includes(term)
        );
      })
    : rawLogs;

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  };

  const getLevelBadge = (level: string) => {
    const config = levelConfig[level as keyof typeof levelConfig];
    const Icon = config?.icon || Info;
    
    return (
      <Badge variant="outline" className={config?.color || 'bg-gray-100 text-gray-800'}>
        <Icon className="h-3 w-3 mr-1" />
        {level.toUpperCase()}
      </Badge>
    );
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.level && filters.level !== 'all') params.append('level', filters.level);
      if (filters.category && filters.category !== 'all') params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      params.append('limit', '10000'); // Export more records
      
      const response = await fetch(`/api/logs?${params}`, { credentials: 'include' });
      const logsData = await response.json();
      
      // Convert to CSV
      const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Source'];
      const csvContent = [
        headers.join(','),
        ...logsData.map((log: AuditLog) => [
          log.timestamp,
          log.level,
          log.category,
          `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
          log.source
        ].join(','))
      ].join('\n');
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uccx-migration-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Logs & Audit Trail</h2>
            <p className="text-sm text-gray-600">Monitor system activities and track migration operations</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export Logs
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Log Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Log Level</label>
                <Select value={filters.level} onValueChange={(value) => handleFilterChange('level', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                    <SelectItem value="migration">Migration</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_24_hours">Last 24 Hours</SelectItem>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <Input
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Log Entries */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading logs...</div>
            ) : !logs || logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No log entries found for the selected filters.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-36">Timestamp</TableHead>
                        <TableHead className="w-20">Level</TableHead>
                        <TableHead className="w-24">Category</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="w-32">Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const timestamp = formatTimestamp(log.timestamp);
                        return (
                          <TableRow key={log.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">{timestamp.date}</div>
                                <div className="text-gray-500">{timestamp.time}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getLevelBadge(log.level)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {log.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-md">
                                <p className="text-sm text-gray-900 break-words">{log.message}</p>
                                {log.metadata && (
                                  <details className="mt-1">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                      View metadata
                                    </summary>
                                    <pre className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded border">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {log.source}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 bg-gray-50">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                      disabled={pagination.offset === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                      disabled={!logs || logs.length < pagination.limit}
                    >
                      Next
                    </Button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing{' '}
                        <span className="font-medium">{pagination.offset + 1}</span>
                        {' '}to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.offset + pagination.limit, (logs?.length || 0) + pagination.offset)}
                        </span>
                        {' '}of{' '}
                        <span className="font-medium">{(logs?.length || 0) + pagination.offset}+</span>
                        {' '}log entries
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                          disabled={pagination.offset === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                          disabled={!logs || logs.length < pagination.limit}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </nav>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
