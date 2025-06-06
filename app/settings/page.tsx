"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const router = useRouter();
    
    useEffect(() => {
        router.push("/settings/search");
    }, [router]);

    return (
        <div></div>
    );
}
