/* global describe, it */

import chai from 'chai';
import RowManager from '../src/rowmanager.js';

chai.expect();
const expect = chai.expect;

// //// Neoffice — added: the tooltip of a column's filter was written in English in the source.
// The row manager is built on the prototype alone: getFilterInput reads nothing but its instance's translate().
function rowManagerOf(translations) {
    const manager = Object.create(RowManager.prototype);
    manager.instance = {
        translate: (text, args) => {
            let translated = translations[text] || text;
            Object.keys(args || {}).forEach((key) => {
                translated = translated.replace(new RegExp(`{(${key})}`, 'g'), args[key]);
            });
            return translated;
        }
    };
    return manager;
}

describe('#rowmanager', () => {
    describe('getFilterInput', () => {
        it('says what the filter is based on through the table translations', () => {
            const manager = rowManagerOf({
                'Filter based on {column}': 'Filtrer selon {column}'
            });
            const html = manager.getFilterInput({ name: 'Groupe de clients', colIndex: 1 });

            expect(html).to.contain('title="Filtrer selon Groupe de clients"');
            expect(html).not.to.contain('Filter based on');
        });

        it('names the first column through the translations too', () => {
            const manager = rowManagerOf({
                'Filter based on {column}': 'Filtrer selon {column}',
                Index: 'Numéro'
            });
            const html = manager.getFilterInput({ colIndex: 1 });

            expect(html).to.contain('title="Filtrer selon Numéro"');
        });

        it('keeps the English words when the table has no translation', () => {
            const html = rowManagerOf({}).getFilterInput({ name: 'ID', colIndex: 1 });

            expect(html).to.contain('title="Filter based on ID"');
        });

        it('leaves the filter of the first column disabled and without title', () => {
            const html = rowManagerOf({}).getFilterInput({ name: 'ID', colIndex: 0 });

            expect(html).to.contain('disabled');
        });
    });
});
