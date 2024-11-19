exports.up = function(knex) {
    return knex.schema.table('certificates', function(table) {
      table.string('activity_name'); // Add a string field 'activity_name'
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.table('certificates', function(table) {
      table.dropColumn('activity_name'); // Remove the 'activity_name' field if rolling back
    });
  };