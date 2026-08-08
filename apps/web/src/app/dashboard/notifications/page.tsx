// Tujuan: Redirect /dashboard/notifications ke /dashboard/settings (Notification Channels dikelola di Project Settings)
// Caller: Next.js router (/dashboard/notifications)

import { redirect } from "next/navigation";

export default function NotificationsPage() {
  redirect("/dashboard/settings");
}
