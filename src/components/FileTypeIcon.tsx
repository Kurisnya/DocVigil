import { FileText, FileSpreadsheet, Presentation, FileType2 } from "lucide-react";
import { DocType } from "@/lib/documents";

const MAP = {
  docx: { Icon: FileText, color: "text-blue-600 bg-blue-50" },
  xlsx: { Icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50" },
  pptx: { Icon: Presentation, color: "text-orange-600 bg-orange-50" },
  pdf: { Icon: FileType2, color: "text-red-600 bg-red-50" },
};

export const FileTypeIcon = ({ type }: { type: DocType }) => {
  const { Icon, color } = MAP[type];
  return (
    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="h-4.5 w-4.5" strokeWidth={2} />
    </div>
  );
};
