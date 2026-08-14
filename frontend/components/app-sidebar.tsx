"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bot, FileCode, GitFork, Sparkles, Wrench } from "lucide-react"

import { ThemeModeToggle } from "@/components/theme-mode-toggle"
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
  useSidebar,
} from "@/components/ui/sidebar"

const navItems = [
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Skills Library", href: "/skills", icon: FileCode },
  { name: "MCP Tools", href: "/mcp-tools", icon: Wrench },
  { name: "Workflows", href: "/workflows", icon: GitFork },
  { name: "Sessions", href: "/sessions", icon: Activity },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Agentic Platform" className="h-12">
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Sparkles data-icon="inline-start" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Agentic Platform</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">Multi-Agent Engine</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.name}
                      isActive={isActive}
                      render={
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                        />
                      }
                    >
                      <Icon data-icon="inline-start" />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="rounded-lg border border-sidebar-border bg-background p-3 font-mono text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <div className="flex justify-between gap-3">
            <span>Engine Status</span>
            <span className="text-agent-success">Online</span>
          </div>
          <div className="mt-1 flex justify-between gap-3 text-[11px]">
            <span>Protocol</span>
            <span>SSE / MCP</span>
          </div>
        </div>
        <div className={isCollapsed ? "flex justify-center" : ""}>
          <ThemeModeToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
