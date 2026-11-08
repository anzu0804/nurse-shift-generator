type DataTableProps = {
  headers: string[];
  children: React.ReactNode;
};

export default function DataTable({
  headers,
  children,
}: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-slate-100">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="p-4 text-left text-sm font-semibold text-slate-700"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}