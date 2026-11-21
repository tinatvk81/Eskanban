import Link from "next/link";
import type { Locale } from "@/i18n/config";

/** The link to the edit page. It is only shown to someone who is allowed to edit the file. */
export function EditLink({
  locale,
  id,
  canEdit,
  label,
}: {
  locale: Locale;
  id: string;
  canEdit: boolean;
  label: string;
}) {
  if (!canEdit) return null;
  return (
    <p>
      <Link href={`/${locale}/files/${id}/edit`} className="files-btn files-btn--primary">
        {label}
      </Link>
    </p>
  );
}
