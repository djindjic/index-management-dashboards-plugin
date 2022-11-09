import React, { useCallback, useState } from "react";
import { EuiDataGrid, EuiDataGridColumn } from "@elastic/eui";

interface IndexPreviewProps {
  columns: EuiDataGridColumn[];
  raw_data: any[];
}

export default ({ columns, raw_data }: IndexPreviewProps) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const onChangeItemsPerPage = useCallback(
    (pageSize) =>
      setPagination((pagination) => ({
        ...pagination,
        pageSize,
        pageIndex: 0,
      })),
    [setPagination]
  );
  const onChangePage = useCallback((pageIndex) => setPagination((pagination) => ({ ...pagination, pageIndex })), [setPagination]);

  const [sortingColumns, setSortingColumns] = useState([]);
  const onSort = useCallback(
    (sortingColumns) => {
      setSortingColumns(sortingColumns);
    },
    [setSortingColumns]
  );

  const [visibleColumns, setVisibleColumns] = useState(columns.map(({ id }) => id));

  return (
    <EuiDataGrid
      aria-labelledby="Index preview"
      columns={columns}
      columnVisibility={{ visibleColumns, setVisibleColumns }}
      rowCount={raw_data ? raw_data.length : 0}
      renderCellValue={({ rowIndex, columnId }) => `${raw_data[rowIndex][columnId]}`}
      inMemory={{ level: "sorting" }}
      sorting={{ columns: sortingColumns, onSort }}
      pagination={{
        ...pagination,
        pageSizeOptions: [10, 50, 100],
        onChangeItemsPerPage: onChangeItemsPerPage,
        onChangePage: onChangePage,
      }}
    />
  );
};
