exports.up = function(knex) {
  return knex.schema.createTable('quotations', function(table) {
    table.string('id').primary();
    table.string('quotationNumber').notNullable().unique();
    table.string('clientName').notNullable();
    table.string('clientEmail');
    table.string('clientPhone');
    table.text('clientAddress');
    table.string('projectName');
    table.date('quotationDate').notNullable();
    table.date('validUntil');
    table.decimal('subtotal', 12, 2).notNullable();
    table.decimal('vatRate', 5, 2).defaultTo(5.00);
    table.decimal('vatAmount', 12, 2).notNullable();
    table.decimal('totalAmount', 12, 2).notNullable();
    table.string('status').defaultTo('Draft'); // Draft, Sent, Accepted, Rejected
    table.text('terms');
    table.text('notes');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('quotations');
};