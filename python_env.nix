with import <nixpkgs> {};
let
  my_pytesseract = python38Packages.pytesseract.override {
      tesseract = my-tesseract;
  };

  my_opencv = python38Packages.opencv4.override {
      enableGtk2 = true;
      enableGtk3 = true;
  };

  my-python-packages = python-packages: [
    python-packages.pip
    python-packages.numpy
    python-packages.unidecode
    python-packages.python-Levenshtein
    python-packages.langdetect
    # python-packages.pytesseract
    python-packages.opencv4
    python-packages.pylint
    python-packages.autopep8

  ];
  my-python = python38.withPackages my-python-packages;
  my-tesseract = tesseract4.override {
      enableLanguages = [ "eng" "fra"];
  };
in
  pkgs.mkShell {
    buildInputs = [
      bashInteractive
      my-python
      my_pytesseract
      # my_opencv
      my-tesseract
    ];
    shellHook = ''
      export PIP_PREFIX="$(pwd)/_build/pip_packages"
      export PYTHONPATH="$(pwd)/_build/pip_packages/lib/python3.8/site-packages:$PYTHONPATH"
      unset SOURCE_DATE_EPOCH
      export DISPLAY=:0
    '';
  }