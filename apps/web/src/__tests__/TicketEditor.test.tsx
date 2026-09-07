import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TicketEditor from "../components/TicketEditor";

describe("TicketEditor", () => {
  it("renders existing tickets", () => {
    render(<TicketEditor tickets={[{ ticketNumber: "INC1453201" }]} onAdd={() => {}} />);
    expect(screen.getByText("INC1453201")).toBeInTheDocument();
  });

  it("calls onAdd with the trimmed ticket number when Add is clicked", () => {
    const onAdd = vi.fn();
    render(<TicketEditor tickets={[]} onAdd={onAdd} />);
    const input = screen.getByPlaceholderText(/ticket/i);
    fireEvent.change(input, { target: { value: "  SCTASK0557608  " } });
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).toHaveBeenCalledWith("SCTASK0557608");
  });

  it("does not call onAdd for an empty input", () => {
    const onAdd = vi.fn();
    render(<TicketEditor tickets={[]} onAdd={onAdd} />);
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
