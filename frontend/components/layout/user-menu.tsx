"use client";

import Link from "next/link";
import { LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_META } from "@/lib/constants";

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** Header avatar menu: identity, role label, profile link, logout. */
export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const roleMeta = ROLE_META[user.role];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 pl-1.5 pr-2"
          aria-label="Open account menu"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
            {user.name || user.email}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1.5 p-3 font-normal">
          <span className="truncate text-sm font-semibold text-foreground">
            {user.name || "—"}
          </span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          <Badge className="w-fit ring-1 ring-inset" variant="outline">
            {roleMeta.label}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon aria-hidden="true" /> Profile settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={logout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
