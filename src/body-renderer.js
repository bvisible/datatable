import HyperList from 'hyperlist';

export default class BodyRenderer {
    constructor(instance) {
        this.instance = instance;
        this.options = instance.options;
        this.datamanager = instance.datamanager;
        this.rowmanager = instance.rowmanager;
        this.cellmanager = instance.cellmanager;
        this.bodyScrollable = instance.bodyScrollable;
        this.footer = this.instance.footer;
        this.log = instance.log;
        this.start = 0;
        this.pageLength = 100;
        this.isLoading = false;
        this.initLazyLoading();
    }

    initLazyLoading() {
        this.bodyScrollable.addEventListener('scroll', () => {
            const scrollPosition = this.bodyScrollable.scrollTop + this.bodyScrollable.clientHeight;
            const threshold = this.bodyScrollable.scrollHeight * 0.80;
            if (scrollPosition >= threshold && cur_list.page_length < cur_list.total_count && !this.isLoading) {
                this.loadMoreRows();
            }
        });
    }

    loadMoreRows() {
        this.isLoading = true;
        console.log("loadMoreRows")
        cur_list.start = cur_list.start + cur_list.page_length;
        cur_list.page_length = cur_list.selected_page_count || 100;
        cur_list.refresh().then(() => {
            setTimeout(() => {
                this.isLoading = false;
            }, 200);
        });
    }

    renderRows(rows) {
        this.visibleRows = rows;
    
        if (rows.length === 0) {
            this.bodyScrollable.innerHTML = this.getNoDataHTML();
            return;
        }
    
        const computedStyle = getComputedStyle(this.bodyScrollable);
        const visibleColumns = this.datamanager.getColumns().filter(col => col.visible !== false);
    
        let config = {
            width: computedStyle.width,
            height: computedStyle.height,
            itemHeight: this.options.cellHeight,
            total: rows.length,
            generate: (index) => {    
                const el = document.createElement('div');
                const row = rows[index];    
                if (row && Array.isArray(row)) {
                    const rowHTML = this.rowmanager.getRowHTML(row, { rowIndex: index });    
                    el.innerHTML = rowHTML;
                    return el.children[0];
                }
                console.warn(`Unable to generate HTML for row ${index}:`, row);
                return el;
            },
            afterRender: () => {
                this.restoreState();
            }
        };
    
        if (!this.hyperlist) {
            this.hyperlist = new HyperList(this.bodyScrollable, config);
        } else {
            this.hyperlist.refresh(this.bodyScrollable, config);
        }
    
        this.renderFooter();
    }

    render() {
        const rows = this.datamanager.getRowsForView();
        this.renderRows(rows);
        this.instance.setDimensions();
    }

    renderFooter() {
        if (!this.options.showTotalRow) return;

        const totalRow = this.getTotalRow();
        let html = this.rowmanager.getRowHTML(totalRow, { isTotalRow: 1, rowIndex: 'totalRow' });

        this.footer.innerHTML = html;
    }

    getTotalRow() {
        const columns = this.datamanager.getColumns();
        const totalRowTemplate = columns.map(col => {
            let content = null;
            if (['_rowIndex', '_checkbox'].includes(col.id)) {
                content = '';
            }
            return {
                content,
                isTotalRow: 1,
                colIndex: col.colIndex,
                column: col
            };
        });

        const totalRow = totalRowTemplate.map((cell, i) => {
            if (cell.content === '') return cell;

            if (this.options.hooks.columnTotal) {
                const columnValues = this.visibleRows.map(row => row[i].content);
                const result = this.options.hooks.columnTotal.call(this.instance, columnValues, cell);
                if (result != null) {
                    cell.content = result;
                    return cell;
                }
            }

            cell.content = this.visibleRows.reduce((acc, prevRow) => {
                const prevCell = prevRow[i];
                if (typeof prevCell.content === 'number') {
                    if (acc == null) acc = 0;
                    return acc + prevCell.content;
                }
                return acc;
            }, cell.content);

            return cell;
        });

        return totalRow;
    }

    restoreState() {
        this.rowmanager.highlightCheckedRows();
        this.cellmanager.selectAreaOnClusterChanged();
        this.cellmanager.focusCellOnClusterChanged();
    }

    showToastMessage(message, hideAfter) {
        this.instance.toastMessage.innerHTML = this.getToastMessageHTML(message);

        if (hideAfter) {
            setTimeout(() => {
                this.clearToastMessage();
            }, hideAfter * 1000);
        }
    }

    clearToastMessage() {
        this.instance.toastMessage.innerHTML = '';
    }

    getNoDataHTML() {
        return `<div class="dt-scrollable__no-data">${this.options.noDataMessage}</div>`;
    }

    getToastMessageHTML(message) {
        return `<span class="dt-toast__message">${message}</span>`;
    }
}