with import <nixpkgs> {};

  pkgs.mkShell {
    buildInputs = [
	  python38
	  sqlite
    ];
    shellHook = ''
      unset SOURCE_DATE_EPOCH
	
	  python server.py
    '';
  }