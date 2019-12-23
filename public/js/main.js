$(function() {
	var height = $("#cs-logo").css("height");
	function fixLogo() {
		var state = window.pageYOffset > $("section:first").offset().top+20;
		$("#cs-logo").toggleClass("fixed", state).parent("a").attr("href", "/").removeAttr(state ? "href" : "").parents(".logo-container").css("height", state ? height : "");
	}

	fixLogo();
	$(window).scroll(fixLogo);

	$("#nav-icon").click(function() {
		$(this).children().toggleClass("is-active");
		var navOpen = $(this).children().hasClass("is-active");
		var slideToggle = navOpen ? "slideDown" : "slideUp";
		$("nav")[slideToggle](function() { if(!navOpen) $(this).css("display", "") });
	});
});
