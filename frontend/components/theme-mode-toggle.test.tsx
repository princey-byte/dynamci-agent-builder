import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeModeToggle } from "./theme-mode-toggle"

const setTheme = vi.fn()

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme,
    theme: "system",
  }),
}))

describe("ThemeModeToggle", () => {
  beforeEach(() => {
    setTheme.mockClear()
  })

  it("lets the user choose light mode", async () => {
    render(<ThemeModeToggle />)

    await userEvent.click(screen.getByRole("button", { name: /toggle theme/i }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /light/i }))

    expect(setTheme).toHaveBeenCalledWith("light")
  })

  it("lets the user choose dark mode", async () => {
    render(<ThemeModeToggle />)

    await userEvent.click(screen.getByRole("button", { name: /toggle theme/i }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /dark/i }))

    expect(setTheme).toHaveBeenCalledWith("dark")
  })

  it("lets the user choose system mode", async () => {
    render(<ThemeModeToggle />)

    await userEvent.click(screen.getByRole("button", { name: /toggle theme/i }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /system/i }))

    expect(setTheme).toHaveBeenCalledWith("system")
  })
})
