"use client";

import type { User } from "better-auth";
import { FileIcon, Home, Settings, ShareIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Files",
    url: "/files",
    icon: FileIcon,
  },
  {
    title: "Shared",
    url: "/shared",
    icon: ShareIcon,
  },
  {
    title: "Recently Deleted",
    url: "/deleted",
    icon: Trash2Icon,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

type AppSidebarProps = {
  user: User | undefined;
} & React.ComponentProps<typeof Sidebar>;

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const userProperty = user
    ? {
        name: user.name,
        email: user.email,
        avatar: user.image ?? "",
      }
    : undefined;
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Image src="/favicon.ico" alt="?" width={20} height={20} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Cifra</span>
                  <span className="truncate text-xs">Secure file storage.</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon />
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userProperty} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
