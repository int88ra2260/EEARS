import { moveIdInExportOrder } from './englishTestExportOrder';

describe('moveIdInExportOrder', () => {
  const ids = [10, 20, 30, 40];

  it('moves up and down', () => {
    expect(moveIdInExportOrder(ids, 30, 'up')).toEqual([10, 30, 20, 40]);
    expect(moveIdInExportOrder(ids, 10, 'down')).toEqual([20, 10, 30, 40]);
  });

  it('moves to top and bottom', () => {
    expect(moveIdInExportOrder(ids, 30, 'top')).toEqual([30, 10, 20, 40]);
    expect(moveIdInExportOrder(ids, 20, 'bottom')).toEqual([10, 30, 40, 20]);
  });

  it('jumps to 1-based position', () => {
    expect(moveIdInExportOrder(ids, 40, 'to', 2)).toEqual([10, 40, 20, 30]);
    expect(moveIdInExportOrder(ids, 10, 'to', 4)).toEqual([20, 30, 40, 10]);
  });

  it('ignores invalid target', () => {
    expect(moveIdInExportOrder(ids, 20, 'to', 0)).toEqual(ids);
    expect(moveIdInExportOrder(ids, 20, 'to', 99)).toEqual(ids);
  });
});
