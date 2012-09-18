/**
 * custom Twitter boostrap functionality
 */
(function ($) {

    if ($.fn.typeahead && $.fn.typeahead.Constructor) {
        // override typeahead  functionality
        $.fn.typeahead.Constructor.prototype.select = function () {
            var val;
            if (this.$menu.find('.active').length == 0) {
                val = this.$element.val();
            }
            else {
                val = this.$menu.find('.active').attr('data-value');
            }   
            this.$element
                .val(this.updater(val))
                .change();
            return this.hide();
        };
        
        $.fn.typeahead.Constructor.prototype.render = function (items) {
            var that = this;

            items = $(items).map(function (i, item) {
                i = $(that.options.item).attr('data-value', item);
                i.find('a').html(that.highlighter(item));
                return i[0];
            });

            // don't autoselect first item
            if (this.options.autoSelect) {
                items.first().addClass('active');
            }
            this.$menu.html(items);
            return this
        };
    }
    
}(window.jQuery));
