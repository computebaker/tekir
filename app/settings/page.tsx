"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
export default function SettingsPage() {
    const router = useRouter();
    const tSettings = useTranslations("settings");
    
    useEffect(() => {
        document.title = `${tSettings("title")} | Tekir`;
        router.push("/settings/search");
    }, [router, tSettings]);

    return (
        <div></div>
    );
}
