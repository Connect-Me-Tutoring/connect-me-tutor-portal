"use client";
import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import { tutorResources } from "@/constants/tutor"; // Importing the resources JSON array
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MobileCard } from "@/components/ui/mobile-card";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/hooks/useLoadMore";

interface Resource {
  title: string;
  link: string;
  subject: string;
  description: string;
  gradeLevel: string;
}

const ResourceList = () => {
  const t = useTranslations("tutorPages.resources");
  const [filteredResources, setFilteredResources] = useState(tutorResources);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterValue, setFilterValue] = useState("");

  useEffect(() => {
    const filtered = tutorResources.filter(
      (resource) =>
        resource.title.toLowerCase().includes(filterValue.toLowerCase()) ||
        resource.description.toLowerCase().includes(filterValue.toLowerCase()),
    );
    setFilteredResources(filtered);
    setCurrentPage(1);
  }, [filterValue]);

  const totalPages = Math.ceil(filteredResources.length / rowsPerPage);

  const handlePageChange = (newPage: any) => {
    setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (value: any) => {
    setRowsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const paginatedResources = filteredResources.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const {
    visibleItems: visibleResources,
    hasMore: hasMoreResources,
    loadMore: loadMoreResources,
  } = useLoadMore(filteredResources);

  return (
    <main className="relative p-8">
      <div className="lg:flex lg:top-8 h-fit">
        <div className="flex gap-4"></div>
      </div>

      <h1 className="text-3xl font-bold mb-6">{t("heading")}</h1>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-grow bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <input
              type="text"
              placeholder={t("filterPlaceholder")}
              className="w-64 border p-2 rounded"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          </div>

          <div className="hidden md:block w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.title")}</TableHead>
                  <TableHead>{t("columns.description")}</TableHead>
                  <TableHead>{t("columns.link")}</TableHead>
                  <TableHead>{t("columns.type")}</TableHead>
                  <TableHead>{t("columns.subject")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResources.map((resource, index) => (
                  <TableRow key={index}>
                    <TableCell>{resource.title}</TableCell>
                    <TableCell>{resource.description}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        onClick={() => window.open(resource.link, "_blank")}
                      >
                        {t("openResource")}
                      </Button>
                    </TableCell>
                    <TableCell>{resource.type}</TableCell>
                    <TableCell>{resource.subject}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 hidden md:flex justify-between items-center">
              <span>{t("resourceTotal", { count: filteredResources.length })}</span>
              <div className="flex items-center space-x-2">
                <span>{t("rowsPerPage")}</span>
                <Select value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
                  <SelectTrigger className="w-[70px]">
                    <SelectValue placeholder={rowsPerPage.toString()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>{t("pageOf", { current: currentPage, total: totalPages })}</span>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    «
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ‹
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    ›
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    »
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="md:hidden space-y-4">
            {visibleResources.map((resource, index) => (
              <MobileCard key={index}>
                <div className="font-semibold text-base">{resource.title}</div>
                <div className="text-sm text-muted-foreground">{resource.description}</div>
                <div className="text-sm space-y-1">
                  <div>{t("mobileType", { type: resource.type })}</div>
                  <div>{t("mobileSubject", { subject: resource.subject })}</div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(resource.link, "_blank")}
                >
                  {t("openResource")}
                </Button>
              </MobileCard>
            ))}
            <LoadMoreButton hasMore={hasMoreResources} onClick={loadMoreResources} />
          </div>
        </div>

        <div className="space-y-8">
          {" "}
          <Card className="w-[300px] aspect-square flex flex-col justify-between">
            <CardHeader>
              <CardTitle>{t("handbook.title")}</CardTitle>
              <CardDescription>{t("handbook.description")}</CardDescription>
            </CardHeader>

            <CardContent>
              <p className="mb-4">{t("handbook.body")}</p>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                onClick={() =>
                  window.open(
                    "https://drive.google.com/file/d/13567c0r06Yp881dGcx5E5LT_miFay9Ep/view?ths=true",
                    "_blank",
                  )
                }
              >
                {t("handbook.button")}
              </Button>
            </CardFooter>
          </Card>
          <Card className="w-[300px] aspect-square flex flex-col justify-between">
            <CardHeader>
              <CardTitle>{t("manual.title")}</CardTitle>
              <CardDescription>{t("manual.description")}</CardDescription>
            </CardHeader>

            <CardContent>
              <p className="mb-4">{t("manual.body")}</p>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                onClick={() =>
                  window.open(
                    "https://docs.google.com/document/d/1Tzc0JA90Ghy76UdBPCRFrUcT27jOxTvqh4yxq1_xVXY/edit?tab=t.0",
                    "_blank",
                  )
                }
              >
                {t("manual.button")}
              </Button>
            </CardFooter>
          </Card>
          <Card className="w-[300px] aspect-square flex flex-col justify-between">
            <CardHeader>
              <CardTitle>{t("faqs.title")}</CardTitle>
              <CardDescription>{t("faqs.description")}</CardDescription>
            </CardHeader>

            <CardContent>
              <p className="mb-4">{t("faqs.body")}</p>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                onClick={() =>
                  window.open(
                    "https://docs.google.com/document/d/1bCP9wAU75cHdgvlERH7m6kaomt3DkFRg1YqWvOHmHbo/edit?tab=t.0",
                    "_blank",
                  )
                }
              >
                {t("faqs.button")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default ResourceList;
