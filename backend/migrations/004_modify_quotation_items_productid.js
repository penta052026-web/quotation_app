exports.up = function(knex) {
  return knex.schema.alterTable('quotation_items', function(table) {
    // Drop the foreign key constraint and make productId nullable
    table.dropForeign('productId');
    table.string('productId').nullable().alter();
    
    // Add foreign key constraint that allows null values
    table.foreign('productId').references('id').inTable('products').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('quotation_items', function(table) {
    // Revert back to not nullable with foreign key
    table.dropForeign('productId');
    table.string('productId').notNullable().alter();
    table.foreign('productId').references('id').inTable('products');
  });
};
