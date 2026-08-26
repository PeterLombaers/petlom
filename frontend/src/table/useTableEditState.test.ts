import { act, renderHook } from "@testing-library/react";
import { makeMockMutation } from "@/test-utils";
import { useTableEditState } from "./useTableEditState";
import type { EditConfig } from "./types";

type TestEntity = { id: number; name: string };

const rows: TestEntity[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

const getRowKey = (row: TestEntity) => row.id;

function makeEditConfig(
  overrides: Partial<EditConfig<TestEntity>> = {},
): EditConfig<TestEntity> {
  return {
    editMutation: makeMockMutation({
      mutateAsync: vi.fn().mockResolvedValue({}),
    }),
    validateData: () => ({}),
    sanitizeData: (d) => d,
    getRequestBody: (d) => d,
    ...overrides,
  };
}

function setup(editConfig: EditConfig<TestEntity> = makeEditConfig()) {
  return renderHook(() =>
    useTableEditState<TestEntity>({
      rows,
      getRowKey,
      entityIdField: "id",
      editConfig,
    }),
  );
}

describe("useTableEditState", () => {
  it("starts with neither edit mode active", () => {
    const { result } = setup();
    expect(result.current.editableRowKey).toBeNull();
    expect(result.current.columnEditField).toBeNull();
    expect(result.current.isColumnEditing).toBe(false);
    expect(result.current.columnEditValues.size).toBe(0);
  });

  describe("mutual exclusion", () => {
    it("startColumnEdit discards a row edit in progress", () => {
      const { result } = setup();
      act(() => result.current.startRowEdit(1));
      act(() => result.current.startColumnEdit("name"));
      expect(result.current.editableRowKey).toBeNull();
      expect(result.current.columnEditField).toBe("name");
    });

    it("startRowEdit discards a column edit in progress", () => {
      const { result } = setup();
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(1, "Charlie"));
      act(() => result.current.startRowEdit(2));
      expect(result.current.editableRowKey).toBe(2);
      expect(result.current.columnEditField).toBeNull();
      expect(result.current.columnEditValues.size).toBe(0);
    });

    it("switching rows keeps only the latest row open", () => {
      const { result } = setup();
      act(() => result.current.startRowEdit(1));
      act(() => result.current.startRowEdit(2));
      expect(result.current.editableRowKey).toBe(2);
      act(() => result.current.stopRowEdit());
      expect(result.current.editableRowKey).toBeNull();
    });
  });

  describe("column edit buffer", () => {
    it("startColumnEdit seeds a value per row from the current data", () => {
      const { result } = setup();
      act(() => result.current.startColumnEdit("name"));
      expect(result.current.isColumnEditing).toBe(true);
      expect([...result.current.columnEditValues]).toEqual([
        [1, "Alice"],
        [2, "Bob"],
      ]);
    });

    it("changeColumnEditValue updates one row without touching the others", () => {
      const { result } = setup();
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(1, "Charlie"));
      expect(result.current.columnEditValues.get(1)).toBe("Charlie");
      expect(result.current.columnEditValues.get(2)).toBe("Bob");
    });

    it("changeColumnEditValue clears that row's error only", async () => {
      const editConfig = makeEditConfig({
        validateData: (d) => (d.name === "" ? { name: "required" } : {}),
      });
      const { result } = setup(editConfig);
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(1, ""));
      act(() => result.current.changeColumnEditValue(2, ""));
      await act(() => result.current.saveColumnEdit());
      expect(result.current.columnEditErrors.size).toBe(2);

      act(() => result.current.changeColumnEditValue(1, "Charlie"));
      expect(result.current.columnEditErrors.has(1)).toBe(false);
      expect(result.current.columnEditErrors.get(2)).toBe("required");
    });

    it("cancelColumnEdit drops the buffer and the errors", () => {
      const { result } = setup();
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(1, "Charlie"));
      act(() => result.current.cancelColumnEdit());
      expect(result.current.columnEditField).toBeNull();
      expect(result.current.isColumnEditing).toBe(false);
      expect(result.current.columnEditValues.size).toBe(0);
      expect(result.current.columnEditErrors.size).toBe(0);
    });
  });

  describe("saveColumnEdit", () => {
    it("does nothing when no column is being edited", async () => {
      const editConfig = makeEditConfig();
      const { result } = setup(editConfig);
      await act(() => result.current.saveColumnEdit());
      expect(editConfig.editMutation.mutateAsync).not.toHaveBeenCalled();
    });

    it("does nothing when editing is unavailable", async () => {
      // No editConfig at all — e.g. a non-moderator viewing the table.
      const { result } = renderHook(() =>
        useTableEditState<TestEntity>({ rows, getRowKey, entityIdField: "id" }),
      );
      act(() => result.current.startColumnEdit("name"));
      await act(() => result.current.saveColumnEdit());
      expect(result.current.columnEditField).toBe("name");
    });

    it("reports validation errors per row and saves nothing", async () => {
      const editConfig = makeEditConfig({
        validateData: (d) => (d.name === "" ? { name: "required" } : {}),
      });
      const { result } = setup(editConfig);
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(2, ""));
      await act(() => result.current.saveColumnEdit());

      expect(editConfig.editMutation.mutateAsync).not.toHaveBeenCalled();
      expect([...result.current.columnEditErrors]).toEqual([[2, "required"]]);
      expect(result.current.columnEditField).toBe("name");
    });

    it("only saves rows whose value changed, keyed by the id field", async () => {
      const editConfig = makeEditConfig();
      const { result } = setup(editConfig);
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(1, "Charlie"));
      await act(() => result.current.saveColumnEdit());

      expect(editConfig.editMutation.mutateAsync).toHaveBeenCalledTimes(1);
      expect(editConfig.editMutation.mutateAsync).toHaveBeenCalledWith({
        body: { id: 1, name: "Charlie" },
        params: { path: { id: 1 } },
      });
    });

    it("exits column edit mode when every row saved", async () => {
      const { result } = setup();
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(1, "Charlie"));
      await act(() => result.current.saveColumnEdit());

      expect(result.current.columnEditField).toBeNull();
      expect(result.current.columnEditValues.size).toBe(0);
      expect(result.current.columnEditErrors.size).toBe(0);
    });

    it("stays in column edit mode and flags only the rows that failed", async () => {
      const mutateAsync = vi.fn(({ params }) =>
        params.path.id === 1
          ? Promise.reject({
              detail: [
                { loc: ["body", "name"], msg: "already taken", type: "value" },
              ],
            })
          : Promise.resolve({}),
      );
      const { result } = setup(
        makeEditConfig({ editMutation: makeMockMutation({ mutateAsync }) }),
      );
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(1, "Charlie"));
      act(() => result.current.changeColumnEditValue(2, "Dave"));
      await act(() => result.current.saveColumnEdit());

      expect(mutateAsync).toHaveBeenCalledTimes(2);
      expect(result.current.columnEditField).toBe("name");
      // The typed values survive so the user can retry without re-entering them.
      expect(result.current.columnEditValues.get(1)).toBe("Charlie");
      expect([...result.current.columnEditErrors.keys()]).toEqual([1]);
      expect(result.current.columnEditErrors.get(1)).toContain("already taken");
    });

    it("falls back to a generic message when a rejection carries no detail", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
      const { result } = setup(
        makeEditConfig({ editMutation: makeMockMutation({ mutateAsync }) }),
      );
      act(() => result.current.startColumnEdit("name"));
      act(() => result.current.changeColumnEditValue(1, "Charlie"));
      await act(() => result.current.saveColumnEdit());

      expect(result.current.columnEditErrors.get(1)).toBe(
        "Something went wrong.",
      );
    });
  });
});
