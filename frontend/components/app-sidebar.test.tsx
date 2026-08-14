import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AppSidebar } from "./app-sidebar"
import { SidebarProvider, SidebarTrigger } from "./ui/sidebar"

vi.mock("next/navigation", () => ({
  usePathname: () => "/workflows",
}))

describe("AppSidebar", () => {
  it("renders dashboard navigation and supports collapse controls", async () => {
    render(
      <SidebarProvider>
        <AppSidebar />
        <SidebarTrigger />
      </SidebarProvider>
    )

    expect(screen.getByRole("button", { name: /agentic platform/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /workflows/i })).toHaveAttribute("aria-current", "page")
    const sidebarToggle = screen.getAllByRole("button", { name: /toggle sidebar/i }).at(-1)

    expect(sidebarToggle).toBeInTheDocument()

    await userEvent.click(sidebarToggle!)

    expect(screen.getByRole("link", { name: /agents/i })).toBeInTheDocument()
  })
})
