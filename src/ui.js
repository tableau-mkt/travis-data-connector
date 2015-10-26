(function ($) {
  $('#IsPrivate').on('change', function() {
    var $password = $('#password');

    if ($(this).is(':checked')) {
      $password.show();
    }
    else {
      $password.hide();
    }
  });
})(jQuery);
