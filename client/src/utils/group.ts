export function groupContinguousIndexes(indexes: number[]) {
  const contiguousIndexes: { start: number; count: number }[] = [];
  if (indexes.length === 0) {
    return contiguousIndexes;
  }
  indexes.sort((a, b) => a - b);
  for (let i = 0; i < indexes.length; i++) {
    const index = indexes[i];
    if (i === 0) {
      contiguousIndexes.push({ start: index, count: 1 });
    } else {
      const lastContiguousIndex = contiguousIndexes[contiguousIndexes.length - 1];
      if (lastContiguousIndex.start + lastContiguousIndex.count === index) {
        lastContiguousIndex.count++;
      } else {
        contiguousIndexes.push({ start: index, count: 1 });
      }
    }
  }

  return contiguousIndexes;
}
