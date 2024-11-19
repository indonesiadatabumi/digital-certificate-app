exports.up = function (knex) {
    return knex.schema.createTable('certificates', (table) => {
        table.increments('id').primary();
        table.string('filename').notNullable();
        table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('uploaded_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('certificates');
};
