$(function() {
	var height = $("#cs-logo").css("height");
	function fixLogo() {
		var state = window.pageYOffset > $("main").offset().top+20;
		$("#cs-logo").toggleClass("fixed", state).parent("a").attr("href", "/").removeAttr(state ? "href" : "");
	}

	fixLogo();
	$(window).scroll(fixLogo);

	$("#nav-button").click(function() {
		$(this).toggleClass("nav-open");
		var navOpen = $(this).hasClass("nav-open");
		$("nav").stop().slideToggle(function() { if(!navOpen) $(this).css("display", "") });
	});
});
