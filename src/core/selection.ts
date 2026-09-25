// Здесь можно добавлять прикладные операции над документом.
export function getSelectionCount(api: PluginAPI): number {
  return api.currentPage.selection.length;
}
