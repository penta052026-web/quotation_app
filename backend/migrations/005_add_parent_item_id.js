exports.up = function(knex) {
  return knex.schema.alterTable('quotation_items', function(table) {
    table.string('parentItemId').nullable()
      .references('id').inTable('quotation_items')
      .onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('quotation_items', function(table) {
    table.dropColumn('parentItemId');
  });
};
