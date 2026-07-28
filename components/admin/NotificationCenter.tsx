"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProfile } from "@/lib/actions/user.actions";
import {
  getAllNotifications,
  updateNotification,
} from "@/lib/actions/notification.actions";
import { formatDate, formatDateAdmin } from "@/lib/utils";
import { Notification } from "@/types";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<
    Notification[]
  >([]);
  const [filterValue, setFilterValue] = useState("Active");
  const [searchValue, setSearchValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [profileCache, setProfileCache] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    filterNotifications();
  }, [filterValue, searchValue, notifications]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const fetchedNotifications = await getAllNotifications();
      if (fetchedNotifications) {
        setNotifications(fetchedNotifications);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const filterNotifications = () => {
    let filtered = notifications;

    if (filterValue !== "All") {
      filtered = filtered.filter(
        (notification) => notification.status === filterValue
      );
    }

    if (searchValue) {
      filtered = filtered.filter((notification) =>
        notification.summary.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    setFilteredNotifications(filtered);
    setCurrentPage(1);
  };

  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const totalPages = Math.ceil(filteredNotifications.length / rowsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const handleStatusChange = async (
    notificationId: string,
    value: "Active" | "Resolved"
  ) => {
    try {
      await updateNotification(notificationId, value);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, status: value }
            : notification
        )
      );
      toast.success("Notification status updated");
    } catch (error) {
      console.error("Failed to update notification status:", error);
      toast.error("Failed to update notification status");
    }
  };

  if (loading) {
    return <Skeleton className="h-[800px] w-full rounded-lg" />;
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Notification Center</h1>

      <div className="flex-grow bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <Input
            type="text"
            placeholder="Search notifications..."
            className="w-64"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="All">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table className="bg-white">
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Previous Date</TableHead>
              <TableHead>Suggested Date</TableHead>
              <TableHead>Tutor Name</TableHead>
              <TableHead>Student Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedNotifications.map((notification) => (
              <TableRow key={notification.id}>
                <TableCell>
                  <Select
                    value={notification.status}
                    onValueChange={(value: "Active" | "Resolved") =>
                      handleStatusChange(notification.id, value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={notification.status} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{formatDateAdmin(notification.createdAt)}</TableCell>
                <TableCell>{notification.summary}</TableCell>
                <TableCell>
                  {formatDateAdmin(notification.previousDate)}
                </TableCell>
                <TableCell>
                  {formatDateAdmin(notification.suggestedDate)}
                </TableCell>
                <TableCell>
                  {notification.tutor?.firstName} {notification.tutor?.lastName}
                </TableCell>
                <TableCell>
                  {notification.student?.firstName}{" "}
                  {notification.student?.lastName}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        <div className="mt-4 flex justify-between items-center">
          <span>{filteredNotifications.length} row(s) total.</span>
          <div className="flex items-center space-x-2">
            <span>Rows per page</span>
            <Select
              value={rowsPerPage.toString()}
              onValueChange={handleRowsPerPageChange}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={rowsPerPage.toString()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default NotificationCenter;
