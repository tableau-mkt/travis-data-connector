(function ($) {
  var $submit = $('input[type="submit"]');
  $('#IsPrivate').on('change', function () {
    if ($(this).is(':checked')) {
      $submit.val('Sign in with GitHub & Connect');
    }
    else {
      $submit.val('Connect');
    }
  });
})(jQuery);
