"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var BinarySearch_1 = require("../utils/BinarySearch");
var ViewabilityTracker = /** @class */ (function () {
    function ViewabilityTracker(renderAheadOffset, initialOffset) {
        var _this = this;
        this._layouts = [];
        this._valueExtractorForBinarySearch = function (index) {
            var itemRect = _this._layouts[index];
            _this._setRelevantBounds(itemRect, _this._relevantDim);
            return _this._relevantDim.end;
        };
        this._currentOffset = Math.max(0, initialOffset);
        this._maxOffset = 0;
        this._actualOffset = 0;
        this._renderAheadOffset = renderAheadOffset;
        this._visibleWindow = { start: 0, end: 0 };
        this._engagedWindow = { start: 0, end: 0 };
        this._isHorizontal = false;
        this._windowBound = 0;
        this._visibleIndexes = []; //needs to be sorted
        this._engagedIndexes = []; //needs to be sorted
        this.onVisibleRowsChanged = null;
        this.onEngagedRowsChanged = null;
        this._relevantDim = { start: 0, end: 0 };
        this._defaultCorrection = { startCorrection: 0, endCorrection: 0, windowShift: 0 };
    }
    ViewabilityTracker.prototype.init = function (windowCorrection) {
        this._doInitialFit(this._currentOffset, windowCorrection);
    };
    ViewabilityTracker.prototype.setLayouts = function (layouts, maxOffset) {
        this._layouts = layouts;
        this._maxOffset = maxOffset;
    };
    ViewabilityTracker.prototype.setDimensions = function (dimension, isHorizontal) {
        this._isHorizontal = isHorizontal;
        this._windowBound = isHorizontal ? dimension.width : dimension.height;
    };
    ViewabilityTracker.prototype.forceRefresh = function () {
        var shouldForceScroll = this._currentOffset >= (this._maxOffset - this._windowBound);
        this.forceRefreshWithOffset(this._currentOffset);
        return shouldForceScroll;
    };
    ViewabilityTracker.prototype.forceRefreshWithOffset = function (offset) {
        this._currentOffset = -1;
        this.updateOffset(offset, false, this._defaultCorrection);
    };
    ViewabilityTracker.prototype.updateOffset = function (offset, isActual, windowCorrection) {
        var correctedOffset = offset;
        if (isActual) {
            this._actualOffset = offset;
            correctedOffset = Math.min(this._maxOffset, Math.max(0, offset + (windowCorrection.windowShift + windowCorrection.startCorrection)));
        }
        if (this._currentOffset !== correctedOffset) {
            this._currentOffset = correctedOffset;
            this._updateTrackingWindows(offset, windowCorrection);
            var startIndex = 0;
            if (this._visibleIndexes.length > 0) {
                startIndex = this._visibleIndexes[0];
            }
            this._fitAndUpdate(startIndex);
        }
    };
    ViewabilityTracker.prototype.getLastOffset = function () {
        return this._currentOffset;
    };
    ViewabilityTracker.prototype.getLastActualOffset = function () {
        return this._actualOffset;
    };
    ViewabilityTracker.prototype.getEngagedIndexes = function () {
        return this._engagedIndexes;
    };
    ViewabilityTracker.prototype.findFirstLogicallyVisibleIndex = function () {
        var relevantIndex = this._findFirstVisibleIndexUsingBS(0.001);
        var result = relevantIndex;
        for (var i = relevantIndex - 1; i >= 0; i--) {
            if (this._isHorizontal) {
                if (this._layouts[relevantIndex].x !== this._layouts[i].x) {
                    break;
                }
                else {
                    result = i;
                }
            }
            else {
                if (this._layouts[relevantIndex].y !== this._layouts[i].y) {
                    break;
                }
                else {
                    result = i;
                }
            }
        }
        return result;
    };
    ViewabilityTracker.prototype.updateRenderAheadOffset = function (renderAheadOffset) {
        this._renderAheadOffset = Math.max(0, renderAheadOffset);
        this.forceRefreshWithOffset(this._currentOffset);
    };
    ViewabilityTracker.prototype.getCurrentRenderAheadOffset = function () {
        return this._renderAheadOffset;
    };
    ViewabilityTracker.prototype.setActualOffset = function (actualOffset) {
        this._actualOffset = actualOffset;
    };
    ViewabilityTracker.prototype._findFirstVisibleIndexOptimally = function () {
        var firstVisibleIndex = 0;
        //TODO: Talha calculate this value smartly
        if (this._currentOffset > 5000) {
            firstVisibleIndex = this._findFirstVisibleIndexUsingBS();
        }
        else if (this._currentOffset > 0) {
            firstVisibleIndex = this._findFirstVisibleIndexLinearly();
        }
        return firstVisibleIndex;
    };
    ViewabilityTracker.prototype._fitAndUpdate = function (startIndex) {
        var newVisibleItems = [];
        var newEngagedItems = [];
        this._fitIndexes(newVisibleItems, newEngagedItems, startIndex, true);
        this._fitIndexes(newVisibleItems, newEngagedItems, startIndex + 1, false);
        this._diffUpdateOriginalIndexesAndRaiseEvents(newVisibleItems, newEngagedItems);
    };
    ViewabilityTracker.prototype._doInitialFit = function (offset, windowCorrection) {
        offset = Math.min(this._maxOffset, Math.max(0, offset));
        this._updateTrackingWindows(offset, windowCorrection);
        var firstVisibleIndex = this._findFirstVisibleIndexOptimally();
        this._fitAndUpdate(firstVisibleIndex);
    };
    //TODO:Talha switch to binary search and remove atleast once logic in _fitIndexes
    ViewabilityTracker.prototype._findFirstVisibleIndexLinearly = function () {
        var count = this._layouts.length;
        var itemRect = null;
        var relevantDim = { start: 0, end: 0 };
        for (var i = 0; i < count; i++) {
            itemRect = this._layouts[i];
            this._setRelevantBounds(itemRect, relevantDim);
            if (this._itemIntersectsVisibleWindow(relevantDim.start, relevantDim.end)) {
                return i;
            }
        }
        return 0;
    };
    ViewabilityTracker.prototype._findFirstVisibleIndexUsingBS = function (bias) {
        if (bias === void 0) { bias = 0; }
        var count = this._layouts.length;
        return BinarySearch_1.default.findClosestHigherValueIndex(count, this._visibleWindow.start + bias, this._valueExtractorForBinarySearch);
    };
    //TODO:Talha Optimize further in later revisions, alteast once logic can be replace with a BS lookup
    ViewabilityTracker.prototype._fitIndexes = function (newVisibleIndexes, newEngagedIndexes, startIndex, isReverse) {
        var count = this._layouts.length;
        var relevantDim = { start: 0, end: 0 };
        var i = 0;
        var atLeastOneLocated = false;
        if (startIndex < count) {
            if (!isReverse) {
                for (i = startIndex; i < count; i++) {
                    if (this._checkIntersectionAndReport(i, false, relevantDim, newVisibleIndexes, newEngagedIndexes)) {
                        atLeastOneLocated = true;
                    }
                    else {
                        if (atLeastOneLocated) {
                            break;
                        }
                    }
                }
            }
            else {
                for (i = startIndex; i >= 0; i--) {
                    if (this._checkIntersectionAndReport(i, true, relevantDim, newVisibleIndexes, newEngagedIndexes)) {
                        atLeastOneLocated = true;
                    }
                    else {
                        if (atLeastOneLocated) {
                            break;
                        }
                    }
                }
            }
        }
    };
    ViewabilityTracker.prototype._checkIntersectionAndReport = function (index, insertOnTop, relevantDim, newVisibleIndexes, newEngagedIndexes) {
        var itemRect = this._layouts[index];
        var isFound = false;
        this._setRelevantBounds(itemRect, relevantDim);
        if (this._itemIntersectsVisibleWindow(relevantDim.start, relevantDim.end)) {
            if (insertOnTop) {
                newVisibleIndexes.splice(0, 0, index);
                newEngagedIndexes.splice(0, 0, index);
            }
            else {
                newVisibleIndexes.push(index);
                newEngagedIndexes.push(index);
            }
            isFound = true;
        }
        else if (this._itemIntersectsEngagedWindow(relevantDim.start, relevantDim.end)) {
            //TODO: This needs to be optimized
            if (insertOnTop) {
                newEngagedIndexes.splice(0, 0, index);
            }
            else {
                newEngagedIndexes.push(index);
            }
            isFound = true;
        }
        return isFound;
    };
    ViewabilityTracker.prototype._setRelevantBounds = function (itemRect, relevantDim) {
        if (this._isHorizontal) {
            relevantDim.end = itemRect.x + itemRect.width;
            relevantDim.start = itemRect.x;
        }
        else {
            relevantDim.end = itemRect.y + itemRect.height;
            relevantDim.start = itemRect.y;
        }
    };
    ViewabilityTracker.prototype._isItemInBounds = function (window, itemBound) {
        return (window.start < itemBound && window.end > itemBound);
    };
    ViewabilityTracker.prototype._isItemBoundsBeyondWindow = function (window, startBound, endBound) {
        return (window.start >= startBound && window.end <= endBound);
    };
    ViewabilityTracker.prototype._isZeroHeightEdgeElement = function (window, startBound, endBound) {
        return startBound - endBound === 0 && (window.start === startBound || window.end === endBound);
    };
    ViewabilityTracker.prototype._itemIntersectsWindow = function (window, startBound, endBound) {
        return this._isItemInBounds(window, startBound) ||
            this._isItemInBounds(window, endBound) ||
            this._isItemBoundsBeyondWindow(window, startBound, endBound) ||
            this._isZeroHeightEdgeElement(window, startBound, endBound);
    };
    ViewabilityTracker.prototype._itemIntersectsEngagedWindow = function (startBound, endBound) {
        return this._itemIntersectsWindow(this._engagedWindow, startBound, endBound);
    };
    ViewabilityTracker.prototype._itemIntersectsVisibleWindow = function (startBound, endBound) {
        return this._itemIntersectsWindow(this._visibleWindow, startBound, endBound);
    };
    ViewabilityTracker.prototype._updateTrackingWindows = function (offset, correction) {
        var startCorrection = correction.windowShift + correction.startCorrection;
        var bottomCorrection = correction.windowShift + correction.endCorrection;
        var startOffset = offset + startCorrection;
        var endOffset = (offset + this._windowBound) + bottomCorrection;
        this._engagedWindow.start = Math.max(0, startOffset - this._renderAheadOffset);
        this._engagedWindow.end = endOffset + this._renderAheadOffset;
        this._visibleWindow.start = startOffset;
        this._visibleWindow.end = endOffset;
    };
    //TODO:Talha optimize this
    ViewabilityTracker.prototype._diffUpdateOriginalIndexesAndRaiseEvents = function (newVisibleItems, newEngagedItems) {
        this._diffArraysAndCallFunc(newVisibleItems, this._visibleIndexes, this.onVisibleRowsChanged);
        this._diffArraysAndCallFunc(newEngagedItems, this._engagedIndexes, this.onEngagedRowsChanged);
        this._visibleIndexes = newVisibleItems;
        this._engagedIndexes = newEngagedItems;
    };
    ViewabilityTracker.prototype._diffArraysAndCallFunc = function (newItems, oldItems, func) {
        if (func) {
            var now = this._calculateArrayDiff(newItems, oldItems);
            var notNow = this._calculateArrayDiff(oldItems, newItems);
            if (now.length > 0 || notNow.length > 0) {
                func(__spreadArray([], newItems, true), now, notNow);
            }
        }
    };
    //TODO:Talha since arrays are sorted this can be much faster
    ViewabilityTracker.prototype._calculateArrayDiff = function (arr1, arr2) {
        var len = arr1.length;
        var diffArr = [];
        for (var i = 0; i < len; i++) {
            if (BinarySearch_1.default.findIndexOf(arr2, arr1[i]) === -1) {
                diffArr.push(arr1[i]);
            }
        }
        return diffArr;
    };
    return ViewabilityTracker;
}());
exports.default = ViewabilityTracker;
//# sourceMappingURL=ViewabilityTracker.js.map