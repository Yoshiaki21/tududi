'use strict';

// 独自実装時代の添付ファイル保存先を本家 v1.14.0 の保存先に揃える。
//
//   project_attachments: projects/<file>  → project-files/<file>
//   note_attachments:    notes/<file>     → note-files/<file>
//
// 本家の一覧 API は file_url を保存先ディレクトリから組み立てるため、旧パスの
// ままだと一覧・プレビューが 404 になる。ファイルは「移動」ではなく「コピー」
// する: Markdown 本文に貼り付けた旧 URL (/api/uploads/projects/...) は元の
// ファイルを参照し続けるため。

const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config/config');

const MOVES = [
    { table: 'project_attachments', from: 'projects', to: 'project-files' },
    { table: 'note_attachments', from: 'notes', to: 'note-files' },
];

async function tableExists(queryInterface, table) {
    const tables = await queryInterface.showAllTables();
    return tables
        .map((t) => (typeof t === 'string' ? t : t.tableName))
        .includes(table);
}

module.exports = {
    async up(queryInterface) {
        const uploadPath = getConfig().uploadPath;

        for (const { table, from, to } of MOVES) {
            if (!(await tableExists(queryInterface, table))) continue;

            const rows = await queryInterface.sequelize.query(
                `SELECT id, file_path FROM ${table} WHERE file_path LIKE :prefix`,
                {
                    replacements: { prefix: `${from}/%` },
                    type: queryInterface.sequelize.QueryTypes.SELECT,
                }
            );
            if (rows.length === 0) continue;

            const targetDir = path.join(uploadPath, to);
            fs.mkdirSync(targetDir, { recursive: true });

            for (const row of rows) {
                const filename = row.file_path.slice(from.length + 1);
                const src = path.join(uploadPath, row.file_path);
                const dest = path.join(targetDir, filename);
                try {
                    if (fs.existsSync(src) && !fs.existsSync(dest)) {
                        fs.copyFileSync(src, dest);
                    }
                } catch (error) {
                    console.warn(
                        `migrate-attachment-dirs: could not copy ${src}: ${error.message}`
                    );
                    continue;
                }
                // ファイルが見つからない行もパスは更新する（どちらにせよ参照不能）
                await queryInterface.sequelize.query(
                    `UPDATE ${table} SET file_path = :filePath WHERE id = :id`,
                    {
                        replacements: {
                            filePath: `${to}/${filename}`,
                            id: row.id,
                        },
                    }
                );
            }
            console.log(
                `migrate-attachment-dirs: ${table} ${rows.length} rows → ${to}/`
            );
        }
    },

    async down(queryInterface) {
        // コピー元のファイルは残しているので、パスを戻すだけでよい
        for (const { table, from, to } of MOVES) {
            if (!(await tableExists(queryInterface, table))) continue;
            await queryInterface.sequelize.query(
                `UPDATE ${table} SET file_path = :from || substr(file_path, :len) WHERE file_path LIKE :prefix`,
                {
                    replacements: {
                        from: `${from}/`,
                        len: to.length + 2,
                        prefix: `${to}/%`,
                    },
                }
            );
        }
    },
};
