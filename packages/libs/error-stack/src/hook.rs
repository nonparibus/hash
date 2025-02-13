use std::{error::Error, fmt, sync::RwLock};

use crate::{
    fmt::{install_builtin_hooks, HookContext, Hooks},
    Frame, Report, Result,
};

type FormatterHook = Box<dyn Fn(&Report<()>, &mut fmt::Formatter<'_>) -> fmt::Result + Send + Sync>;

static FMT_HOOK: RwLock<Hooks> = RwLock::new(Hooks {
    inner: Vec::new(),
    fallback: None,
});
static DEBUG_HOOK: RwLock<Option<FormatterHook>> = RwLock::new(None);
static DISPLAY_HOOK: RwLock<Option<FormatterHook>> = RwLock::new(None);

/// A hook can only be set once.
///
/// Returned by [`Report::set_debug_hook()`] or [`Report::set_display_hook()`] if a hook was already
/// set.
#[derive(Debug, Copy, Clone)]
#[non_exhaustive]
#[deprecated(
    since = "0.2.0",
    note = "`Report::install_debug_hook()` and `Report::install_display_hook()` are infallible"
)]
pub struct HookAlreadySet;

#[allow(deprecated)]
impl fmt::Display for HookAlreadySet {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt.write_str("Hook can only be set once")
    }
}

#[allow(deprecated)]
impl Error for HookAlreadySet {}

impl Report<()> {
    /// Can be used to globally set a [`Debug`] format hook, for a specific type `T`.
    ///
    /// This hook will be called on every [`Debug`] call, if an attachment with the same type has
    /// been found.
    ///
    /// [`Debug`]: core::fmt::Debug
    ///
    /// # Examples
    ///
    /// ```
    /// # // we only test the snapshot on rust 1.65, therefore report is unused (so is render)
    /// # #![cfg_attr(not(rust_1_65), allow(dead_code, unused_variables, unused_imports))]
    /// use std::io::{Error, ErrorKind};
    ///
    /// use error_stack::{
    ///     report, Report,
    /// };
    ///
    /// struct Suggestion(&'static str);
    ///
    /// Report::install_debug_hook::<Suggestion>(|val, ctx| {
    ///     ctx.push_body(format!("Suggestion: {}", val.0));
    /// });
    ///
    /// let report =
    ///     report!(Error::from(ErrorKind::InvalidInput)).attach(Suggestion("O no, try again"));
    ///
    /// # owo_colors::set_override(true);
    /// # fn render(value: String) -> String {
    /// #     let backtrace = regex::Regex::new(r"Backtrace No\. (\d+)\n(?:  .*\n)*  .*").unwrap();
    /// #     let backtrace_info = regex::Regex::new(r"backtrace with (\d+) frames \((\d+)\)").unwrap();
    /// #
    /// #     let value = backtrace.replace_all(&value, "Backtrace No. $1\n  [redacted]");
    /// #     let value = backtrace_info.replace_all(value.as_ref(), "backtrace with [n] frames ($2)");
    /// #
    /// #     ansi_to_html::convert_escaped(value.as_ref()).unwrap()
    /// # }
    /// #
    /// # #[cfg(rust_1_65)]
    /// # expect_test::expect_file![concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots/doc/hook__debug_hook.snap")].assert_eq(&render(format!("{report:?}")));
    /// #
    /// println!("{report:?}");
    /// ```
    ///
    /// Which will result in something like:
    ///
    /// <pre>
    #[doc = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots/doc/hook__debug_hook.snap"))]
    /// </pre>
    ///
    /// This example showcases the ability of hooks to be invoked for values provided via the
    /// Provider API using [`Error::provide`].
    ///
    /// ```
    /// # // this is a lot of boilerplate, if you find a better way, please change this!
    /// # // with #![cfg(nightly)] docsrs will complain that there's no main in non-nightly
    /// # #![cfg_attr(nightly, feature(error_generic_member_access, provide_any))]
    /// # const _: &'static str = r#"
    /// #![feature(error_generic_member_access, provide_any)]
    /// # "#;
    ///
    /// # #[cfg(nightly)]
    /// # mod nightly {
    /// use std::any::Demand;
    /// use std::error::Error;
    /// use std::fmt::{Display, Formatter};
    /// use error_stack::{Report, report};
    ///
    /// struct Suggestion(&'static str);
    ///
    /// #[derive(Debug)]
    /// struct ErrorCode(u64);
    ///
    ///
    /// #[derive(Debug)]
    /// struct UserError {
    ///     code: ErrorCode
    /// }
    ///
    /// impl Display for UserError {
    ///     fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
    ///         f.write_str("Invalid user input")
    ///     }
    /// }
    ///
    /// impl Error for UserError {
    ///  fn provide<'a>(&'a self, req: &mut Demand<'a>) {
    ///    req.provide_value(|| Suggestion("Try better next time!"));
    ///    req.provide_ref(&self.code);
    ///  }
    /// }
    ///
    /// # pub fn main() {
    /// Report::install_debug_hook::<Suggestion>(|Suggestion(val), ctx| {
    ///     ctx.push_body(format!("Suggestion: {val}"));
    /// });
    /// Report::install_debug_hook::<ErrorCode>(|ErrorCode(val), ctx| {
    ///     ctx.push_body(format!("Error Code: {val}"));
    /// });
    ///
    /// let report = report!(UserError {code: ErrorCode(420)});
    ///
    /// # owo_colors::set_override(true);
    /// # fn render(value: String) -> String {
    /// #     let backtrace = regex::Regex::new(r"Backtrace No\. (\d+)\n(?:  .*\n)*  .*").unwrap();
    /// #     let backtrace_info = regex::Regex::new(r"backtrace with (\d+) frames \((\d+)\)").unwrap();
    /// #
    /// #     let value = backtrace.replace_all(&value, "Backtrace No. $1\n  [redacted]");
    /// #     let value = backtrace_info.replace_all(value.as_ref(), "backtrace with [n] frames ($2)");
    /// #
    /// #     ansi_to_html::convert_escaped(value.as_ref()).unwrap()
    /// # }
    /// #
    /// # expect_test::expect_file![concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots/doc/hook__debug_hook_provide.snap")].assert_eq(&render(format!("{report:?}")));
    /// #
    /// println!("{report:?}");
    /// # }
    /// # }
    /// # #[cfg(not(nightly))]
    /// # fn main() {}
    /// # #[cfg(nightly)]
    /// # fn main() {nightly::main()}
    /// ```
    ///
    /// Which will result in something like:
    ///
    /// <pre>
    #[doc = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots/doc/hook__debug_hook_provide.snap"))]
    /// </pre>
    #[cfg(feature = "std")]
    pub fn install_debug_hook<T: Send + Sync + 'static>(
        hook: impl Fn(&T, &mut HookContext<T>) + Send + Sync + 'static,
    ) {
        install_builtin_hooks();

        let mut lock = FMT_HOOK.write().expect("should not be poisoned");
        lock.insert(hook);
    }

    /// Can be used to globally set the fallback [`Debug`] hook, which is called for every
    /// attachment for which a hook wasn't registered using [`install_debug_hook`].
    ///
    /// You can refer to the `debug_stack` for a more in-depth look, as to how to potentially
    /// exploit the fallback for more advanced use-cases, like using a, immutable builder pattern
    /// instead, or a trait based approach.
    ///
    /// [`Debug`]: core::fmt::Debug
    /// [`install_debug_hook`]: Self::install_debug_hook
    ///
    /// # Examples
    ///
    /// ```
    /// # // we only test the snapshot on rust 1.65, therefore report is unused (so is render)
    /// # #![cfg_attr(not(rust_1_65), allow(dead_code, unused_variables, unused_imports))]
    /// use std::io::{Error, ErrorKind};
    /// use error_stack::{report, Report};
    ///
    /// struct Suggestion(&'static str);
    ///
    /// Report::install_debug_hook_fallback(|_, ctx| {
    ///     ctx.push_body("unknown");
    /// });
    ///
    /// let report =
    ///     report!(Error::from(ErrorKind::InvalidInput)).attach(Suggestion("O no, try again"));
    ///
    /// # owo_colors::set_override(true);
    /// # fn render(value: String) -> String {
    /// #     let backtrace = regex::Regex::new(r"Backtrace No\. (\d+)\n(?:  .*\n)*  .*").unwrap();
    /// #     let backtrace_info = regex::Regex::new(r"backtrace with (\d+) frames \((\d+)\)").unwrap();
    /// #
    /// #     let value = backtrace.replace_all(&value, "Backtrace No. $1\n  [redacted]");
    /// #     let value = backtrace_info.replace_all(value.as_ref(), "backtrace with [n] frames ($2)");
    /// #
    /// #     ansi_to_html::convert_escaped(value.as_ref()).unwrap()
    /// # }
    /// #
    /// # #[cfg(rust_1_65)]
    /// # expect_test::expect_file![concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots/doc/hook__fallback.snap")].assert_eq(&render(format!("{report:?}")));
    /// #
    /// println!("{report:?}");
    /// ```
    ///
    /// Which will result in something like:
    ///
    /// <pre>
    #[doc = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots/doc/hook__fallback.snap"))]
    /// </pre>
    ///
    /// This example showcases how we can use the fallback hook to downcast `UserError` and provide
    /// custom formatting for it's content:
    ///
    /// ```
    /// # // we only test the snapshot on rust 1.65, therefore report is unused (so is render)
    /// # #![cfg_attr(not(rust_1_65), allow(dead_code, unused_variables, unused_imports))]
    /// use std::{
    ///     error::Error,
    ///     fmt::{Display, Formatter},
    /// };
    ///
    /// use error_stack::{report, Report};
    ///
    /// #[derive(Debug)]
    /// struct ErrorCode(u64);
    ///
    /// #[derive(Debug)]
    /// struct UserError {
    ///     code: ErrorCode,
    /// }
    ///
    /// impl Display for UserError {
    ///     fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
    ///         f.write_str("Invalid user input")
    ///     }
    /// }
    ///
    /// impl Error for UserError {}
    ///
    /// // this will never called, because we **do not** provide `ErrorCode` in `UserError`
    /// // we instead use fallback to provide better diagnostics.
    /// Report::install_debug_hook::<ErrorCode>(|_, ctx| {
    ///     ctx.push_body("Error Code");
    /// });
    ///
    /// Report::install_debug_hook_fallback(|frame, ctx| {
    ///     // add additional attachments, but only if we're a context of type `UserError`
    ///     if let Some(error) = frame.downcast_ref::<UserError>() {
    ///         ctx.push_body(format!("Error Code: {}", error.code.0));
    ///     }
    /// });
    ///
    /// let report = report!(UserError {code: ErrorCode(404)});
    ///
    /// # owo_colors::set_override(true);
    /// # fn render(value: String) -> String {
    /// #     let backtrace = regex::Regex::new(r"Backtrace No\. (\d+)\n(?:  .*\n)*  .*").unwrap();
    /// #     let backtrace_info = regex::Regex::new(r"backtrace with (\d+) frames \((\d+)\)").unwrap();
    /// #
    /// #     let value = backtrace.replace_all(&value, "Backtrace No. $1\n  [redacted]");
    /// #     let value = backtrace_info.replace_all(value.as_ref(), "backtrace with [n] frames ($2)");
    /// #
    /// #     ansi_to_html::convert_escaped(value.as_ref()).unwrap()
    /// # }
    /// #
    /// # #[cfg(rust_1_65)]
    /// # expect_test::expect_file![concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots/doc/hook__fallback_context.snap")].assert_eq(&render(format!("{report:?}")));
    /// #
    /// println!("{report:?}");
    /// ```
    ///
    /// Which will result in something like:
    ///
    /// <pre>
    #[doc = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots/doc/hook__fallback_context.snap"))]
    /// </pre>
    #[cfg(feature = "std")]
    pub fn install_debug_hook_fallback(
        hook: impl Fn(&Frame, &mut HookContext<Frame>) + Send + Sync + 'static,
    ) {
        let mut lock = FMT_HOOK.write().expect("should not be poisoned");
        lock.fallback(hook);
    }

    /// Returns the hook that was previously set by [`install_debug_hook`]
    ///
    /// [`install_debug_hook`]: Self::install_debug_hook
    #[cfg(feature = "std")]
    pub(crate) fn get_debug_format_hook<T>(closure: impl FnOnce(&Hooks) -> T) -> T {
        install_builtin_hooks();

        let hook = FMT_HOOK.read().expect("should not be poisoned");
        closure(&hook)
    }

    /// Globally sets a hook which is called when formatting [`Report`] with the [`Debug`] trait.
    ///
    /// By intercepting the default [`Debug`] implementation, this hook adds the possibility for
    /// downstream crates to provide their own formatting like colored output or a machine-readable
    /// output (i.e. JSON).
    ///
    /// If not set, [`Debug`] will print
    ///   * The latest error
    ///   * The errors causes
    ///   * The [`Backtrace`] and [`SpanTrace`] **if captured**
    ///
    /// [`Debug`]: core::fmt::Debug
    /// [`Backtrace`]: std::backtrace::Backtrace
    /// [`SpanTrace`]: tracing_error::SpanTrace
    ///
    /// # Note
    ///
    /// Since `0.2` this will overwrite the previous hook (if set) instead of returning
    /// [`HookAlreadySet`].
    ///
    /// # Errors
    ///
    /// No longer returns an error since version `0.2`, the return value has been preserved for
    /// compatibility.
    ///
    /// # Example
    ///
    /// ```
    /// use std::io::{Error, ErrorKind};
    ///
    /// use error_stack::{report, Report};
    ///
    /// #[allow(deprecated)]
    /// # fn main() -> Result<(), Report<error_stack::HookAlreadySet>> {
    /// # #[allow(deprecated)]
    /// Report::set_debug_hook(|_, fmt| write!(fmt, "custom debug implementation"))?;
    ///
    /// let report = report!(Error::from(ErrorKind::InvalidInput));
    /// assert_eq!(format!("{report:?}"), "custom debug implementation");
    /// # Ok(()) }
    /// ```
    #[deprecated(since = "0.2.0", note = "use Report::install_debug_hook() instead")]
    #[cfg(feature = "std")]
    #[allow(deprecated)]
    pub fn set_debug_hook<H>(hook: H) -> Result<(), HookAlreadySet>
    where
        H: Fn(&Self, &mut fmt::Formatter) -> fmt::Result + Send + Sync + 'static,
    {
        let mut write = DEBUG_HOOK.write().expect("should not poisoned");
        *write = Some(Box::new(hook));

        Ok(())
    }

    /// Returns the hook that was previously set by [`set_debug_hook`], if any.
    ///
    /// [`set_debug_hook`]: Self::set_debug_hook
    #[cfg(feature = "std")]
    pub(crate) fn get_debug_hook<T>(closure: impl FnOnce(&FormatterHook) -> T) -> Option<T> {
        let hook = DEBUG_HOOK.read().expect("should not poisoned");
        hook.as_ref().map(|hook| closure(hook))
    }

    /// Globally sets a hook that is called when formatting [`Report`] with the [`Display`] trait.
    ///
    /// By intercepting the default [`Display`] implementation, this hook adds the possibility
    /// for downstream crates to provide their own formatting like colored output or a
    /// machine-readable output (i.e. JSON).
    ///
    /// If not set, [`Display`] will print the latest error and, if alternate formatting is enabled
    /// (`"{:#}"`) and it exists, its direct cause.
    ///
    /// [`Display`]: fmt::Display
    ///
    /// # Note
    ///
    /// Since `0.2` this will overwrite the previous hook (if set) instead of returning
    /// [`HookAlreadySet`].
    ///
    /// # Errors
    ///
    /// No longer returns an error since version `0.2`, the return value has been preserved for
    /// compatibility.
    ///
    /// # Example
    ///
    /// ```
    /// use std::io::{Error, ErrorKind};
    ///
    /// use error_stack::{report, Report};
    ///
    /// #[allow(deprecated)]
    /// # fn main() -> Result<(), Report<error_stack::HookAlreadySet>> {
    /// # #[allow(deprecated)]
    /// Report::set_display_hook(|_, fmt| write!(fmt, "custom display implementation"))?;
    ///
    /// let report = report!(Error::from(ErrorKind::InvalidInput));
    /// assert_eq!(report.to_string(), "custom display implementation");
    /// # Ok(()) }
    /// ```
    #[deprecated]
    #[cfg(feature = "std")]
    #[allow(deprecated)]
    pub fn set_display_hook<H>(hook: H) -> Result<(), HookAlreadySet>
    where
        H: Fn(&Self, &mut fmt::Formatter) -> fmt::Result + Send + Sync + 'static,
    {
        let mut write = DISPLAY_HOOK.write().expect("should not poisoned");
        *write = Some(Box::new(hook));

        Ok(())
    }

    /// Returns the hook that was previously set by [`set_display_hook`], if any.
    ///
    /// [`set_display_hook`]: Self::set_display_hook
    #[cfg(feature = "std")]
    pub(crate) fn get_display_hook<T>(closure: impl FnOnce(&FormatterHook) -> T) -> Option<T> {
        let hook = DISPLAY_HOOK.read().expect("should not poisoned");
        hook.as_ref().map(|hook| closure(hook))
    }
}

impl<T> Report<T> {
    /// Converts the `&Report<T>` to `&Report<()>` without modifying the frame stack.
    ///
    /// Changing `Report<T>` to `Report<()>` is only used internally for calling [`get_debug_hook`]
    /// and [`get_display_hook`] and is intentionally not exposed.
    ///
    /// [`get_debug_hook`]: Self::get_debug_hook
    /// [`get_display_hook`]: Self::get_display_hook
    pub(crate) const fn generalized(&self) -> &Report<()> {
        // SAFETY: `Report` is repr(transparent), so it's safe to cast between `Report<A>` and
        //         `Report<B>`
        unsafe { &*(self as *const Self).cast() }
    }
}
