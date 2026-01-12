exports.up = function(knex) {
  return knex.schema.createTable('products', function(table) {
    table.string('id').primary();
    table.string('itemCode').notNullable().unique();
    table.text('description').notNullable();
    table.string('category').notNullable();
    table.string('subcategory');
    table.string('unit').defaultTo('NOS');
    table.decimal('unitPrice', 10, 2).notNullable();
    table.string('currency').defaultTo('AED');
    table.text('specifications');
    table.string('dimensions');
    table.string('material');
    table.string('brand').defaultTo('PENTA');
    table.string('warranty').defaultTo('1 Year');
    table.string('availability').defaultTo('Available');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('products');
};