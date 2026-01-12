exports.up = function(knex) {
  return knex.schema.table('quotations', function(table) {
    table.decimal('discountPercentage', 5, 2).defaultTo(0);
    table.decimal('discountAmount', 12, 2).defaultTo(0);
  });
};

exports.down = function(knex) {
  return knex.schema.table('quotations', function(table) {
    table.dropColumn('discountPercentage');
    table.dropColumn('discountAmount');
  });
};
