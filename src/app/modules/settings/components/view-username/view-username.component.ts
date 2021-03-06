import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { from } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';

import { LOGIN_ERROR, UPDATE_DATA_ERROR, UPDATE_DATA_SUCCESS } from '../../../../constants/messages';
import { AuthService } from '../../../../services/auth.service';
import { BrowserService } from '../../../../services/browser.service';
import { DataLayerService } from '../../../../services/data-layer.service';
import { UsersService } from '../../../../services/users.service';
import { DialogComponent } from '../../../mdc/components/dialog/dialog.component';
import { SnackbarComponent } from '../../../mdc/components/snackbar/snackbar.component';

@Component({
  selector: 'app-view-username',
  template: `
    <form [formGroup]='formGroup' (ngSubmit)='onMutate()' class='block-form'>
      <h2 mdc-typography headline6>現在のユーザネーム</h2>
      <div
        mdc-text-field
        withTrailingIcon
        fullwidth
        class='mdc-text-field--padding'
      >
        <input mdc-text-field-input formControlName='currentUsername' placeholder='username' [readonly]='true'>
        <div mdc-line-ripple></div>
      </div>

      <h2 mdc-typography headline6>新しいユーザネーム</h2>
      <div
        mdc-text-field
        withTrailingIcon
        fullwidth
        class='mdc-text-field--padding'
      >
        <input mdc-text-field-input formControlName='newUsername' placeholder='username?'>
        <i mdc-text-field-icon role="button">edit</i>
        <div mdc-line-ripple></div>
      </div>

      <div class='block-form-submut'>
        <button mdc-button raised [disabled]='isDisabled' (click)="onMutate()">
          <span>変更する</span>
        </button>
      </div>
    </form>

    <aside mdc-dialog>
      <div mdc-dialog-surface>
        <header mdc-dialog-header>
          <h2 mdc-dialog-header-title>ログインが必要です</h2>
        </header>
        <section mdc-dialog-body>
          <form [formGroup]='loginFormGroup' (ngSubmit)='onLogin()'>
            <div
              mdc-text-field
              withTrailingIcon
              fullwidth
              class='mdc-text-field--padding'
            >
              <input mdc-text-field-input formControlName='username' placeholder='ユーザネーム' [readonly]='true'>
              <div mdc-line-ripple></div>
            </div>
            <div
              mdc-text-field
              withTrailingIcon
              fullwidth
              class='mdc-text-field--padding'
            >
              <input mdc-text-field-input formControlName='password' placeholder='パスワード' [readonly]='true'>
              <div mdc-line-ripple></div>
            </div>
          </form>
        </section>
        <footer mdc-dialog-footer>
          <button mdc-dialog-footer-button accept (click)='onLogin()'>ログイン</button>
        </footer>
      </div>
      <div mdc-dialog-backdrop></div>
    </aside>

    <div mdc-snackbar align-start>
      <div mdc-snackbar-text></div>
      <div mdc-snackbar-action-wrapper>
        <button mdc-snackbar-action-button></button>
      </div>
    </div>
  `,
  styleUrls: ['view-username.component.scss'],
})
export class ViewUsernameComponent implements OnInit {
  public formGroup: FormGroup;
  public loginFormGroup: FormGroup;
  public isLoadingMutatation = false;
  public isLoadingLogin = false;

  @ViewChild(DialogComponent)
  private dialogComponent: DialogComponent;

  @ViewChild(SnackbarComponent)
  private snackbarComponent: SnackbarComponent;

  constructor(
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private usersService: UsersService,
    private browserService: BrowserService,
    private activatedRoute: ActivatedRoute,
    private dataLayerService: DataLayerService,
  ) {
  }

  public get isDisabled() {
    return !this.formGroup.get('newUsername').value;
  }

  public ngOnInit() {
    this.setForm();
    this.setLoginForm();
    const snapshot = this.activatedRoute.snapshot;
    this.browserService.updateAppUIFromSnapshot(snapshot);
    this.browserService.updateHtmlFromSnapshot(snapshot);
    this.dataLayerService.pushPage();
  }

  public onMutate() {
    if (this.isLoadingMutatation) {
      return;
    }

    this.isLoadingMutatation = true;

    this.formGroup.controls.newUsername.markAsDirty();

    if (!this.formGroup.valid) {
      this.isLoadingMutatation = false;
      return;
    }

    const { newUsername } = this.formGroup.value;

    const newEmail = `${newUsername}@swimmy.io`;

    const email$ = this.authService.updateEmail(newEmail).pipe(
      mergeMap(() => {
        return this.usersService.updateUser({
          username: newUsername,
        });
      }),
      tap(() => {
        this.isLoadingMutatation = false;
      }),
    );

    email$.subscribe(() => {
      this.snackbarComponent.snackbar.show({ message: UPDATE_DATA_SUCCESS });
      this.resetFormGroup();
    }, (err) => {
      if (err.code === 'auth/requires-recent-login') {
        this.dialogComponent.dialog.show();
      } else {
        this.snackbarComponent.snackbar.show({ message: UPDATE_DATA_ERROR });
      }
    });
  }

  public onLogin() {
    if (this.isLoadingLogin) {
      return;
    }

    this.dialogComponent.dialog.listen('MDCDialog:accept', () => {
      this.isLoadingLogin = false;
    });

    this.dialogComponent.dialog.listen('MDCDialog:cancel', () => {
      this.isLoadingLogin = false;
    });

    this.isLoadingLogin = true;

    this.loginFormGroup.get('username').markAsDirty();

    if (!this.loginFormGroup.valid) {
      return;
    }

    const currentUser = this.authService.currentUser;
    const { username, password } = this.loginFormGroup.value;
    const { newUsername } = this.formGroup.value;

    const email = `${username}@swimmy.io`;
    const newEmail = `${newUsername}@swimmy.io`;

    const credential = this.authService.auth.EmailAuthProvider.credential(email, password);

    const reauthenticate$ = this.authService.reauthenticateWithCredential(credential).pipe(
      mergeMap(() => {
        return from(currentUser.updateEmail(newEmail));
      }),
      mergeMap(() => {
        return this.usersService.updateUser({
          username: newUsername,
        });
      }),
      tap(() => {
        this.isLoadingLogin = false;
      }),
    );

    reauthenticate$.subscribe(() => {
      this.snackbarComponent.snackbar.show({ message: UPDATE_DATA_SUCCESS });
      this.dialogComponent.dialog.close();
      this.resetFormGroup();
    }, (err) => {
      this.snackbarComponent.snackbar.show({ message: LOGIN_ERROR });
    });
  }

  private setLoginForm() {
    const user = this.authService.currentUser;

    const username = user.email.replace('@swimmy.io', '');

    this.loginFormGroup = this.formBuilder.group({
      username: [username, []],
      password: [null, [Validators.required]],
    });
  }

  private setForm() {
    const user = this.authService.currentUser;

    const username = user.email.replace('@swimmy.io', '');

    this.formGroup = this.formBuilder.group({
      currentUsername: [username, [Validators.max(10)]],
      newUsername: [null, [Validators.required, Validators.max(10)]],
    });
  }

  private resetFormGroup() {
    const user = this.authService.currentUser;

    const username = user.email.replace('@swimmy.io', '');

    this.formGroup.reset({ currentUsername: username, newUsername: '' });
  }
}
