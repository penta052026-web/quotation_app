exports.up = function(knex) {
  return knex.schema.createTable('quotation_items', function(table) {
    table.string('id').primary();
    table.string('quotationId').notNullable().references('id').inTable('quotations').onDelete('CASCADE');
    table.string('productId').notNullable().references('id').inTable('products');
    table.integer('quantity').notNullable();
    table.decimal('unitPrice', 10, 2).notNullable();
    table.decimal('totalPrice', 12, 2).notNullable();
    table.text('customDescription'); // If different from product description
    table.text('notes');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('quotation_items');
};